/**
 * The dials a caller may turn on the mascot's motion.
 *
 * The physics is still the mascot's: this surface adjusts a character, it does
 * not replace one. Every dial has a tuned default, every value a caller
 * supplies is clamped into a region the simulation is stable in, and anything
 * non-finite falls back rather than reaching a spring — the same boundary
 * discipline `normalizeGazeIntents` applies to gaze data.
 */

import { clamp } from "./geometry.js";
import type { SpringConfig } from "./spring.js";

/**
 * A spring described the way a caller can reason about it.
 *
 * Stiffness and damping are the integrator's vocabulary, not a caller's: a
 * stiffness of 420 means nothing without the damping beside it, and the pair
 * together decide whether the integrator is stable at all. Frequency and
 * damping ratio separate those concerns — frequency is how quickly the spring
 * wants to arrive, the ratio is what it does on the way — and each can be
 * clamped on its own.
 */
export interface SpringTuning {
  /** Natural frequency in hertz. Higher arrives sooner. */
  frequency: number;
  /**
   * Damping ratio. Below 1 overshoots and rings, 1 arrives without
   * overshooting, above 1 crawls in without ever reaching past.
   */
  damping: number;
}

/** Everything a caller may adjust about how the mascot moves. */
export interface MascotTuning {
  /** The eyes. Only a look past the deadzone moves them. */
  gaze: SpringTuning;
  /** The jelly in flight. A low ratio here is what rings after a saccade. */
  jellyFree: SpringTuning;
  /** The jelly at the end of its travel, where a held look settles. */
  jellyContact: SpringTuning;
  /** Scales every deformation drive. 0 is a rigid eye, 0.4 is the default. */
  squish: number;
  /** Scales drift and tremor. 0 is a still eye, which reads as a frozen one. */
  restlessness: number;
  /** Mean seconds between blinks. */
  blinkInterval: number;
  /** Random seconds added above that mean, so blinks are not metronomic. */
  blinkSpread: number;
  /** How far a look must reach, in viewBox units, before the eyes answer it. */
  deadzone: number;
}

/* The numbers the mascot was actually tuned at, in the integrator's own
 * vocabulary. The caller-facing defaults below are derived from these rather
 * than written out again, so supplying no tuning reproduces exactly the motion
 * these were tuned to produce. */
const GAZE: SpringConfig = { stiffness: 288, damping: 28 };
const JELLY_FREE: SpringConfig = { stiffness: 165, damping: 11 };
const JELLY_CONTACT: SpringConfig = { stiffness: 165, damping: 26 };

/** Unit mass, so stiffness is the square of the angular frequency. */
const tuningOf = (spring: SpringConfig): SpringTuning => {
  const angular = Math.sqrt(spring.stiffness);
  return { frequency: angular / (2 * Math.PI), damping: spring.damping / (2 * angular) };
};

/* The pair is one rigid feature rather than a shell with something loose
 * inside it, so the gaze spring is a little slower and near critical — that is
 * what keeps both discs together through a saccade — and the deformation is
 * scaled well down, or their spacing rubber-bands on the way. The deadzone is
 * narrow because there is no pupil to spend a short glance on: what the eyes
 * do not answer, nothing does. */
export const DEFAULT_TUNING: MascotTuning = {
  gaze: tuningOf(GAZE),
  jellyFree: tuningOf(JELLY_FREE),
  jellyContact: tuningOf(JELLY_CONTACT),
  squish: 0.4,
  restlessness: 1,
  blinkInterval: 2.6,
  blinkSpread: 4.5,
  deadzone: 4,
};

/**
 * The dials for a reader who has asked for less motion.
 *
 * Not a second physics and not a freeze: paired with `ATTENTIVE_GAZE_INTENTS`,
 * these dials widen the deadzone until no attending look reaches past it, take
 * the deformation out and damp the drift, all while leaving the blink cadence
 * alone. The deadzone is stated rather than inherited because that is the dial
 * the claim rests on — a mascot retuned to look further should not quietly
 * stop settling.
 *
 * A renderer decides *whether* to reach for this; the character decides what it
 * means, so a second binding settles the same way this one does.
 */
export const SETTLED_TUNING: Partial<MascotTuning> = {
  squish: 0,
  restlessness: 0.4,
  deadzone: 9,
};

/*
 * Limits. The frequency ceiling is the one that matters: semi-implicit Euler
 * is stable while the angular frequency times the step stays under about 2,
 * and the simulation steps at 1/240 s. Six hertz is an angular frequency of
 * 37.7, so that product is 0.16 — a margin of roughly twelve. No tuning a
 * caller can express is therefore able to destabilise the integrator, which
 * is the whole reason this surface is frequency and ratio rather than
 * stiffness and damping.
 *
 * The damping ratio has no bearing on stability, so its limits are only there
 * to keep a value legible as motion: below 0.05 the ringing outlasts any
 * glance, and above 4 the spring is slower than the state transitions around
 * it.
 */
const MIN_FREQUENCY = 0.3;
const MAX_FREQUENCY = 6;
const MIN_RATIO = 0.05;
const MAX_RATIO = 4;

const number = (value: unknown, fallback: number, low: number, high: number): number =>
  typeof value === "number" && Number.isFinite(value) ? clamp(value, low, high) : fallback;

const spring = (value: Partial<SpringTuning> | undefined, fallback: SpringTuning): SpringConfig => {
  const frequency = number(value?.frequency, fallback.frequency, MIN_FREQUENCY, MAX_FREQUENCY);
  const damping = number(value?.damping, fallback.damping, MIN_RATIO, MAX_RATIO);
  const angular = 2 * Math.PI * frequency;
  return { stiffness: angular * angular, damping: 2 * damping * angular };
};

/** Tuning in the form the simulation consumes: springs, already stable. */
export interface ResolvedTuning {
  gaze: SpringConfig;
  jellyFree: SpringConfig;
  jellyContact: SpringConfig;
  squish: number;
  restlessness: number;
  blinkInterval: number;
  blinkSpread: number;
  deadzone: number;
}

/**
 * Resolve caller tuning against the defaults, refusing anything that would
 * put a non-finite value or an unstable spring into the simulation.
 *
 * A missing dial, a non-finite one, and a dial of the wrong type all take the
 * default: this boundary serves plain JavaScript and data loaded from a file,
 * not only callers TypeScript has already checked.
 */
export function resolveTuning(tuning?: Partial<MascotTuning> | null): ResolvedTuning {
  const given = (tuning && typeof tuning === "object" ? tuning : {}) as Partial<MascotTuning>;
  return {
    gaze: spring(given.gaze, DEFAULT_TUNING.gaze),
    jellyFree: spring(given.jellyFree, DEFAULT_TUNING.jellyFree),
    jellyContact: spring(given.jellyContact, DEFAULT_TUNING.jellyContact),
    squish: number(given.squish, DEFAULT_TUNING.squish, 0, 3),
    restlessness: number(given.restlessness, DEFAULT_TUNING.restlessness, 0, 4),
    blinkInterval: number(given.blinkInterval, DEFAULT_TUNING.blinkInterval, 0.2, 60),
    blinkSpread: number(given.blinkSpread, DEFAULT_TUNING.blinkSpread, 0, 60),
    deadzone: number(given.deadzone, DEFAULT_TUNING.deadzone, 0, 30),
  };
}

/** The resolved defaults, so the common path allocates nothing. */
export const DEFAULT_RESOLVED: ResolvedTuning = resolveTuning();
