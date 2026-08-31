/**
 * The same character, drawn by something that is not React.
 *
 * This file imports nothing but `@bakebot/core` — no React, no DOM library,
 * no stylesheet. It exists to prove that `pose()` is the renderer seam: every
 * field is consumed here, and the geometry comes from `mascotGeometry` rather
 * than being re-typed.
 *
 * `STATE_POSE` closes the other gap. Working squints and MaybeBlocked droops
 * here for the same reason they do in SVG, from the same numbers.
 *
 * What remains renderer-owned is colour and the two one-shot entrances
 * (`NeedsAttention`, `Notified`). Those are transitions rather than poses, so
 * this binding simply does not have them.
 */

import {
  ATTENTIVE_GAZE_INTENTS,
  createMascot,
  facingEyes,
  mascotGeometry,
  REST_POSE,
  SETTLED_TUNING,
  STATE_GAZE,
  STATE_POSE,
  type BakebotIconState,
  type MascotGeometry,
  type MascotShapeName,
  type MascotPose,
  type MascotStatePose,
  type MascotTuning,
  type TileSpec,
} from "@bakebot/core";

export interface CanvasMascotOptions {
  state?: BakebotIconState;
  size?: number;
  /** Colours are the renderer's decision, not the character's. */
  colors?: { tile: string; eyes: string };
  seed?: number;
  tuning?: Partial<MascotTuning> | null;
  /** The same two reduced-motion behaviours the React binding offers. */
  reducedMotion?: "freeze" | "settle";
  /** The same shapes the React binding offers, by name or as a spec. */
  shape?: MascotShapeName | TileSpec;
}

const DEFAULT_COLORS = { tile: "#767676", eyes: "#fbfbfd" } as const;

/**
 * Draw one frame. Pure: given the two poses and a context, this is the mascot.
 *
 * The state pose and simulation pose interleave in the same order as the SVG
 * groups: state around the whole face, live translation, live jelly, then the
 * state pose of the pair. That lets a state hold a shape while the eyes remain
 * alive inside it.
 */
export function drawMascot(
  context: CanvasRenderingContext2D,
  pose: MascotPose,
  state: MascotStatePose,
  colors: { tile: string; eyes: string },
  geometry: MascotGeometry,
): void {
  const { view, centre, tile, eyes, lid } = geometry;
  context.clearRect(0, 0, view, view);

  context.fillStyle = colors.tile;
  context.beginPath();
  context.roundRect(tile.x, tile.y, tile.width, tile.height, tile.radius);
  context.fill();

  // The eyes may hang past the tile, so the tile cuts them off. The clip is
  // taken before any eye transform; otherwise its outline would move with what
  // it is clipping.
  context.save();
  context.clip();

  context.save();
  context.translate(centre + state.eyeX, centre + state.eyeY);
  context.scale(state.eyeScaleX, state.eyeScaleY);
  context.translate(pose.x, pose.y);

  // Stretch is an axis: rotate onto it, scale, then rotate back.
  context.rotate((pose.angle * Math.PI) / 180);
  context.scale(pose.stretch, pose.squash);
  context.rotate((-pose.angle * Math.PI) / 180);

  context.translate(0, state.pairY);
  context.scale(state.pairScaleX, state.pairScaleY);
  context.fillStyle = colors.eyes;

  // `facingEyes` keeps the pair's midpoint on this origin. A save per disc is
  // what makes its turn foreshortening and blink happen around its own centre
  // instead of folding both eyes toward the nose.
  for (const disc of facingEyes(pose.yaw, pose.pitch, geometry)) {
    context.save();
    // The blink stays screen-vertical outside the rotated ellipse, and its
    // drop follows that ellipse's vertical support — see `useEyeMotion`.
    const rotation = (disc.rotation * Math.PI) / 180;
    const verticalScale = Math.hypot(
      disc.scaleX * Math.sin(rotation),
      disc.scaleY * Math.cos(rotation),
    );
    const drop = pose.lid * lid.drop * verticalScale;
    context.translate(disc.x, disc.y + drop);
    context.scale(1, 1 - pose.lid * lid.close);
    context.rotate(rotation);
    context.scale(disc.scaleX, disc.scaleY);
    context.beginPath();
    context.arc(0, 0, eyes.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.restore();
  context.restore();
}

/** Mount one mascot onto a canvas. Returns the teardown. */
export function mountCanvasMascot(
  canvas: HTMLCanvasElement,
  options: CanvasMascotOptions = {},
): () => void {
  const { state = "Idle", size = 96, colors = DEFAULT_COLORS, seed, shape } = options;
  const geometry = mascotGeometry(shape);
  const context = canvas.getContext("2d");
  if (!context) return () => {};

  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.height = Math.round(size * ratio);
  canvas.style.width = canvas.style.height = `${size}px`;

  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const settling = reduced && options.reducedMotion === "settle";
  const stateGaze = STATE_GAZE[state] ?? null;
  const statePose = STATE_POSE[state] ?? REST_POSE;
  let intents = stateGaze;
  if (intents !== null && settling) intents = ATTENTIVE_GAZE_INTENTS;

  const mascot = createMascot({
    intents,
    seed,
    tuning: settling ? SETTLED_TUNING : options.tuning,
    shape,
  });

  const scale = (size * ratio) / geometry.view;
  context.setTransform(scale, 0, 0, scale, 0, 0);

  // Frozen, or a state whose pose has already shut the eyes: draw rest once
  // and stop. There is no frame loop to run.
  if (stateGaze === null || (reduced && !settling)) {
    drawMascot(context, mascot.pose(), statePose, colors, geometry);
    return () => {};
  }

  let previous = performance.now();
  const tick = (time: number) => {
    frame = requestAnimationFrame(tick);
    mascot.advance(Math.max(0, (time - previous) / 1000));
    previous = time;
    drawMascot(context, mascot.pose(), statePose, colors, geometry);
  };
  let frame = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(frame);
}
