import type { CSSProperties } from "react";

import "./gisx-icon.css";
import { STATE_GAZE } from "./states";
import type { GazeIntent, GisxIconConfig, GisxIconPaneState, GisxIconState } from "./types";
import { useIdleMotion } from "./useIdleMotion";

export interface GisxIconProps {
  /**
   * A pane state straight off the model, payload included. The icon does its
   * own normalising, so a caller never converts one first — `<GisxIcon
   * state={entry.attention.state} />` is the whole wiring.
   */
  state?: GisxIconPaneState;
  size?: number;
  label?: string;
  /** Visual options. Omit this to use the neutral gray brand colour. */
  config?: GisxIconConfig;
  /**
   * Places to look, overriding what the state would choose. A state whose pose
   * has shut the eye stays shut: `STATE_GAZE` decides whether the mark is
   * alive, and this decides only where it looks while it is.
   */
  gazeIntents?: readonly GazeIntent[];
}

function paneStateName(state: GisxIconPaneState): GisxIconState {
  return typeof state === "string" ? state : "Exited";
}

/**
 * The gisx mark: one stable tile and an eye made from two circles.
 *
 * Behaviour is a continuous simulation rather than a queue of clips. The eye
 * is a mass on a stiff spring confined to the tile inset by its own radius,
 * and everything expressive falls out of that: it stretches along its
 * velocity, splats and rings when it meets a wall, pools into a corner when it
 * is asked to look past one, and flinches when the hit is hard. Blinks and
 * glances overlap because there is only one clock.
 *
 * The state is painted in two layers that never write the same element. Colour
 * and pose are CSS, in `gisx-icon.css`, keyed on the `data-state` the
 * attention badge is keyed on; the life underneath comes from `STATE_GAZE`.
 * The nesting below is that division — each `__state-*` group holds a
 * `__*-motion` group.
 */
export function GisxIcon({
  state = "Idle",
  size = 32,
  label,
  config,
  gazeIntents,
}: GisxIconProps) {
  const appearance = paneStateName(state);
  const stateGaze = STATE_GAZE[appearance];
  const motion = useIdleMotion(stateGaze && (gazeIntents ?? stateGaze));
  const style = config?.color
    ? ({ "--gisx-icon-color": config.color } as CSSProperties)
    : undefined;

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className="gisx-icon"
      data-state={appearance}
      // The simulation writes the motion layers every frame, so their state
      // transition must be off while it runs and on for the hand-off out.
      data-live={stateGaze ? "" : undefined}
      height={size}
      role={label ? "img" : undefined}
      style={style}
      viewBox="0 0 64 64"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect className="gisx-icon__tile" height="60" rx="16" width="60" x="2" y="2" />
      <g className="gisx-icon__state-pose">
        <g className="gisx-icon__eye-motion" ref={motion.eye}>
          <g className="gisx-icon__state-expression">
            <g className="gisx-icon__expression-motion" ref={motion.expression}>
              <circle className="gisx-icon__outer" cx="32" cy="32" r="14" />
              <g className="gisx-icon__pupil-action">
                <g className="gisx-icon__pupil-pose">
                  <g className="gisx-icon__pupil-motion" ref={motion.pupilMotion}>
                    <g className="gisx-icon__pupil-dilation" ref={motion.pupilDilation}>
                      <circle className="gisx-icon__inner" cx="32" cy="32" r="6" />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
