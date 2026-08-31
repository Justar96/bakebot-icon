/**
 * The curated public surface.
 *
 * What is exported here is the mascot: a driver, the dials on its motion, the
 * places it looks, the geometry it lives in, and the protocol it takes its
 * state from. What is not exported is the engine underneath — the integrator,
 * the signed distance field, the eye's own step function. A renderer needs
 * none of those, and keeping them private is what allows the physics to be
 * retuned without that being a breaking change for anyone.
 *
 * This package does *not* declare `sideEffects`. It used to declare
 * `sideEffects: false`, which is true of it, but Bun applies that hint to the
 * package it is *building* rather than only to consumers: with it set, an
 * entrypoint of named re-exports prunes to a list of names with nothing
 * defining them, and the build succeeds anyway (oven-sh/bun#27709, a
 * regression in 1.3.10, still open). The field bought nothing here — `dist` is
 * one pre-bundled ESM module with no top-level side effects, so bundlers shake
 * it identically with the field, without it, and with `sideEffects: true`
 * (measured on Bun and Rollup). `scripts/build.ts` asserts the bundle contains
 * its implementation, so if the field ever comes back the build says so rather
 * than shipping.
 */

export { createMascot } from "./mascot.js";
export type { Mascot, MascotOptions, MascotPose } from "./mascot.js";
export { DEFAULT_TUNING, SETTLED_TUNING } from "./tuning.js";
export type { MascotTuning, SpringTuning } from "./tuning.js";
export { ATTENTIVE_GAZE_INTENTS, DEFAULT_GAZE_INTENTS } from "./gaze.js";
export { facingEyes, mascotGeometry, MASCOT_GEOMETRY, MASCOT_SHAPES } from "./geometry.js";
export type { FacingEye, MascotGeometry, MascotShapeName, TileSpec } from "./geometry.js";
export { REST_POSE, STATE_GAZE, STATE_POSE } from "./states.js";
export type { MascotStatePose } from "./states.js";
export type { GazeIntent, GisxIconPaneState, GisxIconState } from "./protocol.js";
