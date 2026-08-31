"use client";

import { useId, type CSSProperties, type Ref } from "react";
import {
  facingEyes,
  mascotGeometry,
  MASCOT_GEOMETRY,
  REST_POSE,
  STATE_GAZE,
  STATE_POSE,
  type MascotShapeName,
  type MascotStatePose,
  type MascotTuning,
  type TileSpec,
} from "@bakebot/core";
import type { GazeIntent, GisxIconConfig, GisxIconPaneState, GisxIconState } from "./types";
import { useEyeMotion, type ReducedMotionBehaviour } from "./useEyeMotion";

/* Where the two eyes sit face-on. Given no geometry because the pair is
 * derived from its own radii rather than from the tile, so it is the same in
 * every shape — see `mascotGeometry`. */
const REST_EYES = facingEyes(0, 0);

export interface GisxIconProps {
  /**
   * A pane state straight off the model, payload included. The mascot does its
   * own normalising, so a caller never converts one first — `<GisxIcon
   * state={entry.attention.state} />` is the whole wiring.
   */
  state?: GisxIconPaneState;
  /** A number of CSS pixels, or any CSS length accepted by SVG. */
  size?: number | string;
  label?: string;
  /** Added beside the internal class that the shipped stylesheet targets. */
  className?: string;
  /** Applied after the mascot's own custom properties, so explicit overrides win. */
  style?: CSSProperties;
  /** The root SVG element. */
  ref?: Ref<SVGSVGElement>;
  /** Look that is not pane state. Omit this to use the neutral gray. */
  config?: GisxIconConfig;
  /**
   * Places to look, overriding what the state would choose. A state whose pose
   * has shut the eye stays shut: `STATE_GAZE` decides whether the mascot is
   * alive, and this decides only where it looks while it is.
   */
  gazeIntents?: readonly GazeIntent[];
  /**
   * How the mascot moves. Every dial is optional and is clamped into a region
   * the simulation is stable in, so this adjusts a character rather than
   * replacing one — `tuning.ts` says what each dial means.
   */
  tuning?: Partial<MascotTuning>;
  /**
   * The tile the mascot lives in — `"square"`, `"rounded"`, `"squircle"`,
   * `"circle"` (the default), `"pill"` or `"card"` — or a `TileSpec` of your
   * own half extents and corner radius.
   *
   * The names are shorthand, not modes: the tile the eye is bounded by and the
   * tile this draws are the same rounded rectangle, so every value in between
   * is a real shape and the simulation follows it without knowing which one it
   * is in.
   */
  shape?: MascotShapeName | TileSpec;
  /**
   * Fix this mascot's run. Two mascots on a page already look different from
   * each other because each draws its own seed and clock phase; passing one
   * makes a run reproducible, which is what a visual test wants and what a
   * page does not need.
   */
  seed?: number;
  /**
   * What `prefers-reduced-motion: reduce` does to this mascot. `freeze` — the
   * default — stops the simulation, which is the only mechanism this component
   * offers for WCAG 2.2.2 and so stays the default. `settle` keeps it alive
   * inside a widened deadzone: the eyes still drift and the lids still blink,
   * but nothing crosses the tile or deforms. On a 32px icon that is a fifth of
   * a pixel of travel against Idle's 11px.
   */
  reducedMotion?: ReducedMotionBehaviour;
}

function paneStateName(state: GisxIconPaneState): GisxIconState {
  return typeof state === "string" ? state : "Exited";
}

/* Which custom property each field of a state pose feeds.
 *
 * The stylesheet still owns the transforms these compose into and the curve
 * they transition on; this owns only the numbers, and they come from
 * `STATE_POSE` rather than from a rule per state — so what a state looks like
 * has one definition, and a canvas binding reads the same one. */
const POSE_PROPERTY = {
  eyeX: "--gisx-eye-x",
  eyeY: "--gisx-eye-y",
  eyeScaleX: "--gisx-eye-scale-x",
  eyeScaleY: "--gisx-eye-scale-y",
  pairY: "--gisx-pair-y",
  pairScaleX: "--gisx-pair-scale-x",
  pairScaleY: "--gisx-pair-scale-y",
} as const satisfies Record<keyof MascotStatePose, string>;

const POSE_FIELDS = Object.keys(POSE_PROPERTY) as (keyof MascotStatePose)[];

/**
 * The custom properties a state departs from rest by, or nothing.
 *
 * Only the departures are written. The stylesheet declares every rest value on
 * the root, so a state that holds one says nothing about it — which keeps Idle
 * free of inline style entirely and a list of mascots free of ten redundant
 * properties each.
 */
function statePoseStyle(appearance: GisxIconState): Record<string, string> | undefined {
  // An unknown runtime state has no pose, the same way it has no gaze.
  const pose = STATE_POSE[appearance] as MascotStatePose | undefined;
  if (!pose) return undefined;

  let style: Record<string, string> | undefined;
  for (const field of POSE_FIELDS) {
    const value = pose[field];
    if (value === REST_POSE[field]) continue;
    style ??= {};
    // Offsets are view units, which the transform reads as lengths; the scale
    // factors are bare numbers.
    style[POSE_PROPERTY[field]] = field.includes("Scale") ? String(value) : `${value}px`;
  }
  return style;
}

/**
 * The gisx mascot: one stable tile and a pair of eyes in it.
 *
 * Behaviour is a continuous simulation rather than a queue of clips. The eyes
 * are one mass on a stiff spring confined to the tile, and everything
 * expressive falls out of that: they stretch along their velocity, ring as
 * they settle, and turn the face toward whatever they are asked to look past —
 * far enough that the tile clips them. Blinks and glances overlap because
 * there is only one clock.
 *
 * The state is painted in two layers that never write the same element. Colour
 * and pose are CSS, in `gisx-icon.css`, keyed on `data-state`; the life
 * underneath comes from `STATE_GAZE`. The nesting below is that division —
 * each `__state-*` group holds a `__*-motion` group.
 */
export function GisxIcon({
  state = "Idle",
  size = 32,
  label,
  className,
  style: callerStyle,
  ref,
  config,
  gazeIntents,
  tuning,
  seed,
  reducedMotion,
  shape,
}: GisxIconProps) {
  const appearance = paneStateName(state);
  // A degenerate size from a plain-JS caller (NaN, 0, negative) must not reach
  // the DOM as an invalid width/height attribute.
  const safeSize =
    typeof size === "number" ? (Number.isFinite(size) && size > 0 ? size : 32) : size;
  /* A state the wire has but this table does not reads as `undefined`, which
   * is not the same thing as "no gaze" to anything downstream. Normalise it to
   * the null the type already promises, so an unknown state is a still mascot
   * rather than a half-alive one. */
  const stateGaze = STATE_GAZE[appearance] ?? null;
  const motion = useEyeMotion(stateGaze && (gazeIntents ?? stateGaze), {
    seed,
    tuning,
    reducedMotion,
    shape,
  });
  /* Drawn from the same resolver the eyes are confined by, so the border on
   * screen is the border they are held inside in any shape. The default is
   * already resolved, so the ordinary case allocates nothing. */
  const geometry = shape === undefined ? MASCOT_GEOMETRY : mascotGeometry(shape);
  /* The eyes are allowed past the tile's border and cut off by it, so the clip
   * has to be the tile itself — the same rect, from the same numbers. React's
   * id is stable across server and client but not a valid bare identifier, so
   * it is sanitised rather than used raw in a fragment reference. */
  const clip = `gisx-tile-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const posed = statePoseStyle(appearance);
  const style =
    posed || config?.color || callerStyle
      ? ({
          ...posed,
          ...(config?.color && { "--gisx-icon-color": config.color }),
          ...callerStyle,
        } as CSSProperties)
      : undefined;

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className ? `gisx-icon ${className}` : "gisx-icon"}
      data-state={appearance}
      // The simulation writes the motion layers every frame, so their state
      // transition must be off while it runs and on for the hand-off out. The
      // hook decides that, not `STATE_GAZE`: a mascot frozen by the reader's
      // motion preference is alive by state and still needs the transition
      // back, or it teleports out of wherever it was last looking.
      data-live={motion.live ? "" : undefined}
      height={safeSize}
      ref={ref}
      role={label ? "img" : undefined}
      style={style}
      viewBox={`0 0 ${geometry.view} ${geometry.view}`}
      width={safeSize}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clip}>
          <rect
            height={geometry.tile.height}
            rx={geometry.tile.radius}
            ry={geometry.tile.radius}
            width={geometry.tile.width}
            x={geometry.tile.x}
            y={geometry.tile.y}
          />
        </clipPath>
      </defs>
      <rect
        className="gisx-icon__tile"
        height={geometry.tile.height}
        rx={geometry.tile.radius}
        ry={geometry.tile.radius}
        width={geometry.tile.width}
        x={geometry.tile.x}
        y={geometry.tile.y}
      />
      {/* The clip goes on a group of its own, outside every transform: a
          `clip-path` is resolved in the user space of the element carrying it,
          so putting it on a layer that moves would carry the tile's own
          outline along with the eyes. */}
      <g className="gisx-icon__frame" clipPath={`url(#${clip})`}>
        <g className="gisx-icon__state-pose">
          <g className="gisx-icon__eye-motion" ref={motion.eye}>
            <g className="gisx-icon__expression-motion" ref={motion.expression}>
              {/* The entrance is a layer of its own because it animates a
                  transform, and the group below already holds one. */}
              <g className="gisx-icon__entrance">
                {/* One group, because the pair's own state pose belongs to
                    the eyes together — a state squints both or neither.
                    Drawn facing straight ahead, which is what a mascot that
                    is frozen or has not had a frame yet stays as; the hook
                    writes the turn as a difference from here. */}
                <g className="gisx-icon__eyes">
                  {/* The Notified blink sits inside the pair pose. Scaling an
                      outer layer also scales `pairY`, which makes the eyes jump
                      upward as they close instead of blinking in place. */}
                  <g className="gisx-icon__notified-blink">
                    <circle
                      className="gisx-icon__disc"
                      cx={geometry.centre + REST_EYES[0].x}
                      cy={geometry.centre}
                      r={geometry.eyes.radius}
                      ref={motion.left}
                    />
                    <circle
                      className="gisx-icon__disc"
                      cx={geometry.centre + REST_EYES[1].x}
                      cy={geometry.centre}
                      r={geometry.eyes.radius}
                      ref={motion.right}
                    />
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
