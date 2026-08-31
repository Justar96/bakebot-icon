/**
 * Wire-shaped pane state the mascot accepts, payload included.
 *
 * `GisxIconState` is derived from this rather than written out again: a
 * string arm names itself, and an arm carrying data is named by its key. The
 * mascot therefore cannot know a state this union does not have, and cannot
 * quietly miss one it does.
 */
export type GisxIconPaneState =
  | "Idle"
  | "Working"
  | "NeedsAttention"
  | "Notified"
  | "MaybeBlocked"
  | { Exited: { code: number | null } };

type NameOf<T> = T extends string ? T : keyof T & string;

/** What the mascot can look like: one appearance per protocol pane state. */
export type GisxIconState = NameOf<GisxIconPaneState>;

/**
 * A place the eye wants to look, in viewBox units from the icon centre.
 *
 * An intent is a wish, not a pose: the simulation decides whether the eye can
 * reach it. An intent outside the travel region is legal and useful — that is
 * how the face is made to turn all the way that way.
 */
export interface GazeIntent {
  x: number;
  y: number;
  /** Seconds to dwell once the eye has stopped moving. */
  hold: number;
}

/** Caller-chosen look that is not pane state and does not retune the physics. */
export interface GisxIconConfig {
  /** Any valid CSS colour. Omit it to use the gisx neutral gray. */
  color?: string;
}
