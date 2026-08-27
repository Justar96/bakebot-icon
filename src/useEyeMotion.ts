import { useEffect, useMemo, useRef, type RefObject } from "react";

import {
  advanceEye,
  blinkClosure,
  createEyeState,
  deformation,
  isBlinking,
  queueBlink,
} from "./eye";
import { createRandom, nextIntentIndex, normalizeGazeIntents } from "./gaze";
import type { GazeIntent } from "./types";

/**
 * The four elements the simulation writes to.
 *
 * The hook creates them rather than accepting them, so the contract is one
 * way round: it owns every inline transform on the mascot, and the component
 * only says where each part is. Nothing else may write these.
 */
interface EyeMotionRefs {
  eye: RefObject<SVGGElement | null>;
  expression: RefObject<SVGGElement | null>;
  pupilMotion: RefObject<SVGGElement | null>;
  pupilDilation: RefObject<SVGGElement | null>;
}

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

const BLINK_INTERVAL = 2.6;
const BLINK_SPREAD = 4.5;
const DOUBLE_BLINK_CHANCE = 0.22;
/** A gaze shift this large often carries a blink with it, as a real one does. */
const GAZE_EVOKED_AMPLITUDE = 13;
const GAZE_EVOKED_CHANCE = 0.5;

/* Meeting a corner hard enough is worth a flinch: a fast partial closure, not
 * a whole blink. */
const FLINCH_IMPACT = 24;
const FLINCH_CORNERNESS = 0.45;
const FLINCH_STRENGTH = 0.42;

const LID_CLOSE = 0.92;
const LID_DROP = 1.6;
const SEED = 0x9e3779b9;

const round = (value: number) => Math.round(value * 1000) / 1000;
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

interface EyePose {
  x: number;
  y: number;
  pupilX: number;
  pupilY: number;
  jellyX: number;
  jellyY: number;
  lid: number;
  dilation: number;
}

/**
 * Owns the simulation and leaves the SVG component declarative.
 *
 * There is one clock and one loop. Blinks, glances and deformation are read
 * out of the same state every frame instead of being queued against each
 * other, which is what lets the eye blink mid-glance and flinch mid-blink.
 *
 * The places to look are also the switch: `null` is a mascot with no life of
 * its own. One argument rather than a flag beside an array, because a flag
 * and an array can disagree about whether the eye is running.
 */
export function useEyeMotion(intents: readonly GazeIntent[] | null): EyeMotionRefs {
  const eye = useRef<SVGGElement>(null);
  const expression = useRef<SVGGElement>(null);
  const pupilMotion = useRef<SVGGElement>(null);
  const pupilDilation = useRef<SVGGElement>(null);

  // Restarting the simulation resets the eye to the centre, so the effect must
  // depend on what the gaze data says rather than on which array object said
  // it. A caller computing its points of interest passes a fresh array every
  // render, and identity alone would rebuild the world each time.
  // Cyclic runtime data from a plain-JS caller throws in stringify; fall back
  // to a stable key and let normalisation drop what it cannot use.
  let gazeKey: string;
  try {
    gazeKey = JSON.stringify(intents);
  } catch {
    gazeKey = "gisx-unserializable-gaze";
  }
  const gaze = useMemo(() => (intents ? normalizeGazeIntents(intents) : null), [gazeKey]);

  useEffect(() => {
    const eyeElement = eye.current;
    const expressionElement = expression.current;
    const pupilMotionElement = pupilMotion.current;
    const pupilDilationElement = pupilDilation.current;
    const elements = [eyeElement, expressionElement, pupilMotionElement, pupilDilationElement];
    const clearTransforms = () => {
      for (const element of elements) element?.style.removeProperty("transform");
    };

    if (!gaze || elements.some((element) => !element)) {
      clearTransforms();
      return;
    }

    // Non-browser DOMs may lack matchMedia; without it there is no reduced
    // motion preference to honour, so the eye simply runs.
    const reducedMotion =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const random = createRandom(SEED);
    const state = createEyeState();

    let intentIndex = 0;
    let intent = gaze[0]!;
    let hold = intent.hold;
    let blinkTimer = BLINK_INTERVAL;
    let clock = 0;
    let previous = 0;
    let accumulator = 0;
    let frame: number | undefined;
    const written = ["", "", "", ""];

    const readPose = (): EyePose => ({
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
        0.05 * Math.sin(clock * 0.77) -
        0.09 * Math.min(state.speed / 120, 1) +
        0.16 * state.press,
    });
    let previousPose = readPose();
    let currentPose = previousPose;

    const restBlinkTimer = () => BLINK_INTERVAL + random() * BLINK_SPREAD;

    const takeNextIntent = () => {
      const candidate = nextIntentIndex(random, intentIndex, gaze);
      const amplitude = Math.hypot(gaze[candidate]!.x - intent.x, gaze[candidate]!.y - intent.y);
      intentIndex = candidate;
      intent = gaze[candidate]!;
      hold = intent.hold;
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
          blinkTimer = Math.max(blinkTimer, BLINK_INTERVAL);
        }
      }
      if (state.speed < SETTLE_SPEED) hold -= SIM_STEP * (1 + PRESS_HASTE * state.press);
      if (hold <= 0) takeNextIntent();
    };

    const write = (slot: number, element: SVGElement, transform: string) => {
      if (written[slot] === transform) return;
      written[slot] = transform;
      element.style.transform = transform;
    };

    const render = () => {
      // Interpolate the fixed physics steps. This removes the small hold/jump
      // pattern that is otherwise visible when a 240 Hz simulation is shown
      // on a 120 Hz or 144 Hz panel.
      const alpha = accumulator / SIM_STEP;
      const x = mix(previousPose.x, currentPose.x, alpha);
      const y = mix(previousPose.y, currentPose.y, alpha);
      const pupilX = mix(previousPose.pupilX, currentPose.pupilX, alpha);
      const pupilY = mix(previousPose.pupilY, currentPose.pupilY, alpha);
      const lid = mix(previousPose.lid, currentPose.lid, alpha);
      const dilation = mix(previousPose.dilation, currentPose.dilation, alpha);
      const { angle, stretch, squash } = deformation(
        mix(previousPose.jellyX, currentPose.jellyX, alpha),
        mix(previousPose.jellyY, currentPose.jellyY, alpha),
      );

      write(0, eyeElement!, `translate3d(${round(x)}px, ${round(y)}px, 0)`);
      // The lid closes in the icon's frame, so it is applied outside the
      // deformation rather than multiplied into it.
      write(
        1,
        expressionElement!,
        `translate3d(0, ${round(lid * LID_DROP)}px, 0) scaleY(${round(1 - lid * LID_CLOSE)}) ` +
          `rotate(${round(angle)}deg) scale(${round(stretch)}, ${round(squash)}) ` +
          `rotate(${round(-angle)}deg)`,
      );
      write(2, pupilMotionElement!, `translate3d(${round(pupilX)}px, ${round(pupilY)}px, 0)`);
      write(3, pupilDilationElement!, `scale(${round(dilation)})`);
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = Math.max(0, (time - previous) / 1000);
      accumulator += Math.min(elapsed, MAX_FRAME_DELTA);
      previous = time;
      while (accumulator >= SIM_STEP) {
        accumulator -= SIM_STEP;
        previousPose = currentPose;
        clock += SIM_STEP;
        advanceEye(state, intent, SIM_STEP, clock);
        schedule();
        currentPose = readPose();
      }
      render();
    };

    const start = () => {
      if (frame !== undefined || document.hidden || reducedMotion?.matches) return;
      previous = performance.now();
      accumulator = 0;
      previousPose = readPose();
      currentPose = previousPose;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    };

    const handlePreference = () => {
      stop();
      if (reducedMotion?.matches) {
        clearTransforms();
        written.fill("");
      } else {
        start();
      }
    };
    const handleVisibility = () => (document.hidden ? stop() : start());

    reducedMotion?.addEventListener("change", handlePreference);
    document.addEventListener("visibilitychange", handleVisibility);
    start();

    return () => {
      stop();
      reducedMotion?.removeEventListener("change", handlePreference);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTransforms();
    };
  }, [gaze]);

  return { eye, expression, pupilMotion, pupilDilation };
}
