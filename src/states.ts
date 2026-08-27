import { ATTENTIVE_GAZE_INTENTS, DEFAULT_GAZE_INTENTS } from "./gaze";
import type { GazeIntent, GisxIconState } from "./types";

/**
 * What each state means to the simulation.
 *
 * Colour and pose are CSS, on the `__state-*` layers. This table owns the
 * layer underneath them: whether the eye is alive, and what it looks at while
 * it is. The two compose because they write different elements — see the group
 * nesting in `GisxIcon.tsx` — so a state does not have to choose between
 * having a pose and having a life.
 *
 * `null` stops the eye's own motion, which suits only a state whose pose has
 * already shut it.
 *
 * The record is exhaustive by type: a state added to the wire fails to compile
 * here until someone has decided how the mascot behaves in it. That is the point
 * of `GisxIconState` being the protocol's own vocabulary rather than a list
 * beside it.
 */
export const STATE_GAZE: Record<GisxIconState, readonly GazeIntent[] | null> = {
  // Nothing to attend to, so the eye is free to wander the whole tile and to
  // press into its corners.
  Idle: DEFAULT_GAZE_INTENTS,
  Working: ATTENTIVE_GAZE_INTENTS,
  NeedsAttention: ATTENTIVE_GAZE_INTENTS,
  Notified: ATTENTIVE_GAZE_INTENTS,
  MaybeBlocked: ATTENTIVE_GAZE_INTENTS,
  // The Exited pose is a shut eye. Anything moving under it reads as a fault
  // rather than as life.
  Exited: null,
};
