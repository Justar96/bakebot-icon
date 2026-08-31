import { ATTENTIVE_GAZE_INTENTS, DEFAULT_GAZE_INTENTS } from "./gaze.js";
import type { GazeIntent, GisxIconState } from "./protocol.js";

/**
 * What each state means to the mascot: what it looks at, and what shape it holds
 * while it does.
 *
 * Both records are exhaustive by type. A state added to the wire fails to
 * compile here until someone has decided how the mascot behaves in it — that is
 * the point of `GisxIconState` being the protocol's own vocabulary rather than a
 * list beside it.
 */

/**
 * Whether the eyes are alive in a state, and where they look while they are.
 *
 * `null` stops their own motion, which suits only a state whose pose has
 * already shut them.
 */
export const STATE_GAZE: Record<GisxIconState, readonly GazeIntent[] | null> = {
  // Nothing to attend to, so the eyes are free to wander the whole tile and to
  // turn the face all the way to its border.
  Idle: DEFAULT_GAZE_INTENTS,
  Working: ATTENTIVE_GAZE_INTENTS,
  NeedsAttention: ATTENTIVE_GAZE_INTENTS,
  Notified: ATTENTIVE_GAZE_INTENTS,
  MaybeBlocked: ATTENTIVE_GAZE_INTENTS,
  // The Exited pose is shut eyes. Anything moving under it reads as a fault
  // rather than as life.
  Exited: null,
};

/**
 * The shape a state holds, in view units and bare scale factors.
 *
 * This is the layer the simulation does not touch. A state's pose and a state's
 * life write different elements — see the group nesting in a renderer — which is
 * what lets a state have a shape and still be alive: the pose says what the
 * mascot *is*, and the gaze above says that it is still living while it is that.
 *
 * It lives here rather than in the React binding's stylesheet because it is a
 * decision about the character, not about SVG. That Working squints and
 * MaybeBlocked droops is as much the mascot as how it blinks, and a second
 * renderer that had to re-type it would be drawing a different character.
 */
export interface MascotStatePose {
  /** Where the eyes sit and how big they are, outside the simulation's motion. */
  eyeX: number;
  eyeY: number;
  eyeScaleX: number;
  eyeScaleY: number;
  /**
   * The pair alone, inside it. This is the layer a squint lives on: a state
   * can narrow the eyes without moving them off the place they are looking.
   */
  pairY: number;
  pairScaleX: number;
  pairScaleY: number;
}

/** No pose at all: centred, round, unscaled. Every state is a departure from this. */
export const REST_POSE: MascotStatePose = {
  eyeX: 0,
  eyeY: 0,
  eyeScaleX: 1,
  eyeScaleY: 1,
  pairY: 0,
  pairScaleX: 1,
  pairScaleY: 1,
};

/* Written as departures from rest so the table reads as what each state does,
 * and so a field nobody meant to change cannot be mistyped into one. */
const from = (departure: Partial<MascotStatePose> = {}): MascotStatePose => ({
  ...REST_POSE,
  ...departure,
});

export const STATE_POSE: Record<GisxIconState, MascotStatePose> = {
  // Wandering is the whole tile; the pose stays out of the way of it.
  Idle: from(),
  // Leaning in and slightly narrowed, the way a face does at close work.
  Working: from({ eyeX: 3, eyeY: 1, pairY: 1, pairScaleY: 0.88 }),
  // Widened. Nothing moves off centre: the state is the look.
  NeedsAttention: from({ pairScaleX: 1.1, pairScaleY: 1.1 }),
  // Glancing up at whatever arrived.
  Notified: from({ eyeY: -2, pairY: 1, pairScaleY: 0.9 }),
  // Turned away and half-lidded.
  MaybeBlocked: from({ eyeX: -4, eyeY: 3, pairScaleY: 0.8 }),
  // Shut: dropped and flattened almost to a line. This is the pose that makes
  // `STATE_GAZE.Exited` null — there is nothing left open to move.
  Exited: from({ eyeY: 7, eyeScaleY: 0.14 }),
};
