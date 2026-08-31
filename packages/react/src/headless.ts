/**
 * The public surface of `@bakebot/react/headless`.
 *
 * This entry carries no stylesheet side effect, so it can be imported by a
 * Node process with no CSS loader. A browser caller still needs the mascot's
 * rules and imports `@bakebot/react/gisx-icon.css` itself.
 */

/* Import before exporting rather than using a named re-export. Bun currently
 * prunes the implementation of a named-re-export entry when this package's
 * manifest narrows side effects to CSS (oven-sh/bun#27709). The local binding
 * makes the implementation reachable without widening the consumer hint. */
import { GisxIcon } from "./GisxIcon";

export { GisxIcon };
export type { GisxIconProps } from "./GisxIcon";
export type { ReducedMotionBehaviour } from "./useEyeMotion";
export {
  ATTENTIVE_GAZE_INTENTS,
  createMascot,
  DEFAULT_GAZE_INTENTS,
  DEFAULT_TUNING,
  facingEyes,
  mascotGeometry,
  MASCOT_GEOMETRY,
  MASCOT_SHAPES,
  REST_POSE,
  SETTLED_TUNING,
  STATE_POSE,
} from "@bakebot/core";
export type {
  FacingEye,
  Mascot,
  MascotGeometry,
  MascotOptions,
  MascotShapeName,
  MascotPose,
  MascotTuning,
  SpringTuning,
} from "@bakebot/core";
export type { MascotStatePose, TileSpec } from "@bakebot/core";
export type { GazeIntent, GisxIconConfig, GisxIconPaneState, GisxIconState } from "./types";
