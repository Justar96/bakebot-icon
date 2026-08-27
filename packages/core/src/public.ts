/**
 * The curated public surface, one level below the entrypoint.
 *
 * What is exported here is the mascot: a driver, the dials on its motion, the
 * places it looks, and the protocol it takes its state from. What is not
 * exported is the engine underneath — the integrator, the signed distance
 * field, the eye's own step function. A renderer needs none of those, and
 * keeping them private is what allows the physics to be retuned without that
 * being a breaking change for anyone.
 *
 * This is a separate module from `index.ts` to work around a bundler bug, not
 * for any design reason — see the comment there.
 */

export { createMascot } from "./mascot";
export type { Mascot, MascotOptions, MascotPose } from "./mascot";
export { DEFAULT_TUNING } from "./tuning";
export type { MascotTuning, SpringTuning } from "./tuning";
export { ATTENTIVE_GAZE_INTENTS, DEFAULT_GAZE_INTENTS } from "./gaze";
export { STATE_GAZE } from "./states";
export type { GazeIntent, GisxIconPaneState, GisxIconState } from "./protocol";
