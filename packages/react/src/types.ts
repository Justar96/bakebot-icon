/**
 * What the React binding adds to the protocol, and what it passes through.
 *
 * The pane state vocabulary and the gaze vocabulary belong to the mascot, not
 * to React, so they live in `@bakebot/core` and are re-exported here. A
 * caller importing from `@bakebot/react` therefore sees one flat surface and never
 * has to know that the character and its renderer are two packages.
 */

export type { GazeIntent, BakebotIconPaneState, BakebotIconState } from "@bakebot/core";

/** Caller-chosen look that is not pane state and does not retune the physics. */
export interface BakebotIconConfig {
  /** Any valid CSS colour. Omit it to use the bakebot neutral gray. */
  color?: string;
}
