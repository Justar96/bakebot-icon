/**
 * The public surface of `gisx-icon`.
 *
 * Every name 0.2.0 exported is still exported from here, from the same
 * specifier, so the split into a character package and a renderer package is
 * invisible to a caller. The character's own exports are re-exported rather
 * than forwarded through a wrapper, so there is one definition of each.
 */

export { GisxIcon } from "./GisxIcon";
export type { GisxIconProps } from "./GisxIcon";
export {
  ATTENTIVE_GAZE_INTENTS,
  createMascot,
  DEFAULT_GAZE_INTENTS,
  DEFAULT_TUNING,
} from "@gisx-icon/core";
export type {
  Mascot,
  MascotOptions,
  MascotPose,
  MascotTuning,
  SpringTuning,
} from "@gisx-icon/core";
export type { GazeIntent, GisxIconConfig, GisxIconPaneState, GisxIconState } from "./types";
