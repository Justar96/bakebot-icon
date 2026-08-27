/**
 * What the React binding adds to the protocol, and what it passes through.
 *
 * The pane state vocabulary and the gaze vocabulary belong to the mascot, not
 * to React, so they live in `@gisx-icon/core` and are re-exported here. A
 * caller importing from `gisx-icon` therefore sees one flat surface and never
 * has to know that the character and its renderer are two packages.
 */

export type { GazeIntent, GisxIconPaneState, GisxIconState } from "@gisx-icon/core";

/** Caller-chosen look that is not pane state and does not retune the physics. */
export interface GisxIconConfig {
  /** Any valid CSS colour. Omit it to use the gisx neutral gray. */
  color?: string;
}
