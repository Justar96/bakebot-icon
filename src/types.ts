/**
 * Wire-shaped pane state the mark accepts, payload included.
 *
 * `GisxIconState` is derived from this rather than written out again: a
 * string arm names itself, and an arm carrying data is named by its key. The
 * icon therefore cannot know a state this union does not have, and cannot
 * quietly miss one it does. `tests/pane-state.test.ts` in `web/` fails when
 * `gisx-icon.css` has no look for a state the Rust defines.
 */
export type GisxIconPaneState =
  | "Idle"
  | "Working"
  | "NeedsAttention"
  | "Notified"
  | "MaybeBlocked"
  | { Exited: { code: number | null } };

type NameOf<T> = T extends string ? T : keyof T & string;

/** What the mark can look like: one appearance per protocol pane state. */
export type GisxIconState = NameOf<GisxIconPaneState>;

/**
 * A place the eye wants to look, in viewBox units from the icon centre.
 *
 * An intent is a wish, not a pose: the simulation decides whether the eye can
 * reach it. An intent outside the travel region is legal and useful — that is
 * how the eye is made to press a wall or pool into a corner.
 */
export interface GazeIntent {
  x: number;
  y: number;
  /** Seconds to dwell once the eye has stopped moving. */
  hold: number;
}

/** Visual options that do not change the icon's state or motion. */
export interface GisxIconConfig {
  /** Any valid CSS colour. Omit it to use the gisx neutral gray. */
  color?: string;
}
