/**
 * The mascot as a character, with no renderer attached.
 *
 * Everything that decides *who* the mascot is lives here: the clock it runs
 * on, how long it dwells on a place before looking elsewhere, when it blinks,
 * what makes it flinch, and how its pupil breathes. A renderer's whole job is
 * to call `advance` with elapsed time and write `pose` somewhere — so a second
 * renderer gets the same character rather than a second version of it.
 *
 * There is one clock. Blinks, glances and deformation are read out of one
 * state every frame instead of being queued against each other, which is what
 * lets the eye blink mid-glance and flinch mid-blink.
 */

import {
  advanceEye,
  blinkClosure,
  createEyeState,
  deformation,
  isBlinking,
  queueBlink,
  type EyeState,
} from "./eye";
import { createRandom, nextIntentIndex, normalizeGazeIntents } from "./gaze";
import { DEFAULT_RESOLVED, resolveTuning, type MascotTuning, type ResolvedTuning } from "./tuning";
import type { GazeIntent } from "./protocol";

/* One fixed step keeps the springs and the collision response identical on a
 * 60 Hz panel and a 144 Hz one; the accumulator absorbs the difference. */
const SIM_STEP = 1 / 240;
/* Preserve 30 Hz operation, but discard a long task's excess time. Replaying
 * a quarter-second of missed physics in one frame makes a decorative eye jump
 * and spends more main-thread time when the page is already busy. */
const MAX_FRAME_DELTA = 1 / 15;
/** Below this travel speed the eye counts as arrived and its dwell starts. */
const SETTLE_SPEED = 3;
/** A press burns its dwell faster: nothing rests long against a wall. */
const PRESS_HASTE = 2.4;

const DOUBLE_BLINK_CHANCE = 0.22;
/** A gaze shift this large often carries a blink with it, as a real one does. */
const GAZE_EVOKED_AMPLITUDE = 13;
const GAZE_EVOKED_CHANCE = 0.5;

/* Meeting a corner hard enough is worth a flinch: a fast partial closure, not
 * a whole blink. */
const FLINCH_IMPACT = 24;
const FLINCH_CORNERNESS = 0.45;
const FLINCH_STRENGTH = 0.42;

/*
 * Seeds. Two mascots mounted in the same frame must not be the same mascot.
 *
 * A seed alone is not enough for that: drift, tremor and dilation are
 * functions of the clock rather than of the random stream, and every clock
 * starts at zero, so two instances with different seeds would still breathe in
 * step. Each mascot therefore also draws a phase offset and adds it to its own
 * clock, which is what actually desynchronises the continuous motion.
 *
 * The default seed walks a counter rather than calling `Math.random`, so a
 * page renders the same way twice and a test does not have to stub anything to
 * be reproducible. A caller that wants a specific run passes `seed`.
 */
const BASE_SEED = 0x9e3779b9;
let created = 0;
const nextSeed = (): number => (BASE_SEED + Math.imul(created++, 0x85ebca6b)) >>> 0;

/** What a renderer needs to draw one frame. Every field is ready to write. */
export interface MascotPose {
  /** Shell offset from the icon centre, in viewBox units. */
  x: number;
  y: number;
  /** Pupil offset from the shell centre. */
  pupilX: number;
  pupilY: number;
  /** Stretch axis in degrees, and the two scale factors along it. */
  angle: number;
  stretch: number;
  squash: number;
  /** How shut the lid is, 0 to 1. */
  lid: number;
  /** Pupil scale. */
  dilation: number;
}

export interface MascotOptions {
  /**
   * Places the eye wants to look. `null` is a mascot with no life of its own —
   * one argument rather than a flag beside an array, because a flag and an
   * array can disagree about whether the eye is running.
   */
  intents?: readonly GazeIntent[] | null;
  /** Fix the run. Omit it and each mascot gets its own. */
  seed?: number;
  tuning?: Partial<MascotTuning> | null;
}

export interface Mascot {
  /** Whether the eye is simulating. */
  readonly alive: boolean;
  /** Advance the world by real elapsed time, in seconds. */
  advance(elapsed: number): void;
  /** The current pose, interpolated between fixed steps. */
  pose(): MascotPose;
  /**
   * Change where the eye looks without resetting the world.
   *
   * This is the difference between a state change the mascot lives through and
   * one it is rebuilt by: the springs, the clock and the lids all carry over,
   * so a mascot that goes from wandering to attending drifts to its new
   * business instead of snapping to the centre first.
   */
  setIntents(intents: readonly GazeIntent[] | null): void;
  /** Retune mid-run. Existing spring state carries over. */
  setTuning(tuning: Partial<MascotTuning> | null): void;
  /** Blink now. 1 is a full closure, less is a squint. */
  blink(strength?: number): void;
}

/** The springs' raw readout at one fixed step, before deformation is derived. */
interface Frame {
  x: number;
  y: number;
  pupilX: number;
  pupilY: number;
  jellyX: number;
  jellyY: number;
  lid: number;
  dilation: number;
}

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

export function createMascot(options: MascotOptions = {}): Mascot {
  const seed = Number.isFinite(options.seed) ? (options.seed as number) >>> 0 : nextSeed();
  const random = createRandom(seed);
  /* Drawn before anything else uses the stream, so the offset is a property of
   * the seed rather than of how many intents happened to be picked first. */
  const phase = random() * 1000;

  const state: EyeState = createEyeState();
  let tuning: ResolvedTuning = options.tuning ? resolveTuning(options.tuning) : DEFAULT_RESOLVED;
  let gaze: readonly GazeIntent[] | null = options.intents
    ? normalizeGazeIntents(options.intents)
    : null;

  let index = 0;
  let intent: GazeIntent = gaze?.[0] ?? { x: 0, y: 0, hold: 1 };
  let hold = intent.hold;
  let blinkTimer = tuning.blinkInterval;
  let clock = 0;
  let accumulator = 0;

  const restBlinkTimer = () => tuning.blinkInterval + random() * tuning.blinkSpread;

  const readFrame = (): Frame => ({
    x: state.x.position,
    y: state.y.position,
    pupilX: state.pupilX.position,
    pupilY: state.pupilY.position,
    jellyX: state.jellyX.position,
    jellyY: state.jellyY.position,
    lid: blinkClosure(state.blinkPhase) * state.blinkStrength,
    // Dilation needs no spring of its own: every input is already smooth.
    dilation:
      1 +
      0.05 * Math.sin((clock + phase) * 0.77) -
      0.09 * Math.min(state.speed / 120, 1) +
      0.16 * state.press,
  });

  let previous: Frame = readFrame();
  let current: Frame = previous;

  const takeNextIntent = () => {
    if (!gaze) return;
    const candidate = nextIntentIndex(random, index, gaze);
    const next = gaze[candidate]!;
    const amplitude = Math.hypot(next.x - intent.x, next.y - intent.y);
    index = candidate;
    intent = next;
    hold = next.hold;
    if (amplitude > GAZE_EVOKED_AMPLITUDE && random() < GAZE_EVOKED_CHANCE) {
      queueBlink(state, 1, 1);
      blinkTimer = restBlinkTimer();
    }
  };

  const schedule = () => {
    blinkTimer -= SIM_STEP;
    if (!isBlinking(state)) {
      if (blinkTimer <= 0) {
        queueBlink(state, random() < DOUBLE_BLINK_CHANCE ? 2 : 1, 1);
        blinkTimer = restBlinkTimer();
      } else if (state.impact > FLINCH_IMPACT && state.cornerness > FLINCH_CORNERNESS) {
        queueBlink(state, 1, FLINCH_STRENGTH);
        blinkTimer = Math.max(blinkTimer, tuning.blinkInterval);
      }
    }
    if (state.speed < SETTLE_SPEED) hold -= SIM_STEP * (1 + PRESS_HASTE * state.press);
    if (hold <= 0) takeNextIntent();
  };

  return {
    get alive() {
      return gaze !== null;
    },

    advance(elapsed: number) {
      if (!gaze) return;
      if (!Number.isFinite(elapsed) || elapsed <= 0) return;
      accumulator += Math.min(elapsed, MAX_FRAME_DELTA);
      while (accumulator >= SIM_STEP) {
        accumulator -= SIM_STEP;
        previous = current;
        clock += SIM_STEP;
        advanceEye(state, intent, SIM_STEP, clock + phase, tuning);
        schedule();
        current = readFrame();
      }
    },

    pose(): MascotPose {
      // Interpolate the fixed physics steps. This removes the small hold/jump
      // pattern that is otherwise visible when a 240 Hz simulation is shown on
      // a 120 Hz or 144 Hz panel.
      const alpha = accumulator / SIM_STEP;
      // The jelly is interpolated and only then turned into an axis: crossing
      // between two poses in double-angle space rotates the stretch axis the
      // short way, where crossing between two already-derived angles would
      // sweep the long way round whenever the axis passed a half turn.
      const { angle, stretch, squash } = deformation(
        mix(previous.jellyX, current.jellyX, alpha),
        mix(previous.jellyY, current.jellyY, alpha),
      );
      return {
        x: mix(previous.x, current.x, alpha),
        y: mix(previous.y, current.y, alpha),
        pupilX: mix(previous.pupilX, current.pupilX, alpha),
        pupilY: mix(previous.pupilY, current.pupilY, alpha),
        angle,
        stretch,
        squash,
        lid: mix(previous.lid, current.lid, alpha),
        dilation: mix(previous.dilation, current.dilation, alpha),
      };
    },

    setIntents(next: readonly GazeIntent[] | null) {
      if (!next) {
        gaze = null;
        return;
      }
      const normalized = normalizeGazeIntents(next);
      const wasAlive = gaze !== null;
      gaze = normalized;
      // Keep the place already being looked at where the new table still has
      // one, so a table swap is a change of business rather than a teleport.
      index = Math.min(index, normalized.length - 1);
      intent = normalized[index]!;
      if (!wasAlive) hold = intent.hold;
    },

    setTuning(next: Partial<MascotTuning> | null) {
      tuning = next ? resolveTuning(next) : DEFAULT_RESOLVED;
    },

    blink(strength = 1) {
      queueBlink(state, 1, Number.isFinite(strength) ? Math.min(Math.max(strength, 0), 1) : 1);
      blinkTimer = restBlinkTimer();
    },
  };
}
