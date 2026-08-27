/**
 * Where the eye wants to look, and how one of those places is chosen.
 *
 * A point of interest is a wish, not a pose: the simulation in `eye.ts`
 * decides how much of it the shell and the pupil each answer, and whether the
 * boundary allows it at all. Keeping the vocabulary here means a caller can
 * supply its own places to look without reading any physics.
 */

import { clamp } from "./geometry";
import type { GazeIntent } from "./protocol";

/**
 * The look length that fills the pupil's whole range, and the scale the
 * weighting is measured in. It belongs to the gaze vocabulary rather than to
 * the eye, because both the rarity rule below and the pupil mapping in
 * `eye.ts` must agree on what "a far look" means.
 */
export const LOOK_REACH = 18;

/**
 * Points of interest, in look units rather than in pixels of travel: what the
 * shell and the pupil each do with one is decided by the shell deadzone and
 * `LOOK_REACH`. Most sit inside the deadzone, so the pupil answers them alone.
 * The far few reach past the border, and those are the ones the eye presses a
 * wall or pools into a corner for — behaviour the simulation arrives at, not a
 * clip played at it. `intentWeight` makes the far ones the rare ones.
 */
export const DEFAULT_GAZE_INTENTS: readonly GazeIntent[] = [
  { x: 0, y: 0, hold: 1.6 },
  { x: 11, y: -6, hold: 1.2 },
  { x: 26, y: -26, hold: 1.4 },
  { x: -10, y: 7, hold: 1.3 },
  { x: -32, y: 0, hold: 0.9 },
  { x: 5, y: 12, hold: 1.1 },
  { x: -24, y: 25, hold: 1.3 },
  { x: 0, y: -9, hold: 1 },
  { x: 24, y: 24, hold: 1.2 },
  { x: -7, y: -10, hold: 1.1 },
] as const;

/**
 * The gaze of a mascot that is attending to something rather than wandering.
 *
 * Every place is inside the shell's deadzone, so the shell holds the centre
 * and each look is the pupil's alone. Drift, tremor and blinks continue, which
 * is what stops a state pose from reading as a frozen picture — the state says
 * what the mascot is, and this says that it is still alive while it is that.
 */
export const ATTENTIVE_GAZE_INTENTS: readonly GazeIntent[] = [
  { x: 0, y: 0, hold: 1.4 },
  { x: 5, y: -3, hold: 0.9 },
  { x: -4, y: 2, hold: 1.1 },
  { x: 2, y: 4, hold: 0.8 },
  { x: -3, y: -4, hold: 1 },
] as const;

/* Public callers can provide gaze data at runtime. Keep bad data from putting
 * NaN or Infinity into the springs, and keep accidental extreme values from
 * making one simulation step overflow. These limits do not change the
 * built-in sequence. */
const MAX_INTENT_COORDINATE = 256;
const MIN_INTENT_HOLD = 0.1;
const MAX_INTENT_HOLD = 30;

/**
 * Return safe runtime gaze data, or the built-in sequence when none is valid.
 * TypeScript checks the shape for callers, but this boundary also serves plain
 * JavaScript and data loaded from files.
 */
export function normalizeGazeIntents(intents: readonly GazeIntent[]): readonly GazeIntent[] {
  // A non-array from a plain-JS caller (a number, an object) is not iterable;
  // refuse it rather than throw during render.
  if (!Array.isArray(intents)) return DEFAULT_GAZE_INTENTS;
  const normalized: GazeIntent[] = [];
  for (const intent of intents) {
    if (
      !intent ||
      !Number.isFinite(intent.x) ||
      !Number.isFinite(intent.y) ||
      !Number.isFinite(intent.hold) ||
      intent.hold <= 0
    ) {
      continue;
    }
    normalized.push({
      x: clamp(intent.x, -MAX_INTENT_COORDINATE, MAX_INTENT_COORDINATE),
      y: clamp(intent.y, -MAX_INTENT_COORDINATE, MAX_INTENT_COORDINATE),
      hold: clamp(intent.hold, MIN_INTENT_HOLD, MAX_INTENT_HOLD),
    });
  }
  return normalized.length > 0 ? normalized : DEFAULT_GAZE_INTENTS;
}

/**
 * Deterministic mulberry32. One stream drives the whole gaze sequence — which
 * place is looked at next, and when a blink falls — so a run is reproducible
 * from its seed alone.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How often a point of interest is chosen. The further it is, the rarer it is,
 * so the eye rests near its centre and an excursion to the border stays an
 * event. The rule is geometric rather than a column in the table, so editing
 * the table cannot leave a stale weight behind.
 */
export function intentWeight(intent: GazeIntent): number {
  return 1 / (1 + Math.hypot(intent.x, intent.y) / LOOK_REACH);
}

/** Pick the next point of interest by weight, never the one already held. */
export function nextIntentIndex(
  random: () => number,
  current: number,
  intents: readonly GazeIntent[],
): number {
  if (intents.length < 2) return 0;

  let total = 0;
  for (let index = 0; index < intents.length; index += 1) {
    if (index !== current) total += intentWeight(intents[index]!);
  }

  let ticket = random() * total;
  for (let index = 0; index < intents.length; index += 1) {
    if (index === current) continue;
    ticket -= intentWeight(intents[index]!);
    if (ticket <= 0) return index;
  }
  return (current + 1) % intents.length;
}
