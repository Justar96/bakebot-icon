import { useEffect, useRef, useState, type RefObject } from "react";

import {
  ATTENTIVE_GAZE_INTENTS,
  createMascot,
  facingEyes,
  MASCOT_GEOMETRY,
  SETTLED_TUNING,
  type FacingEye,
  type Mascot,
  type MascotShapeName,
  type MascotTuning,
  type TileSpec,
} from "@bakebot/core";
import type { GazeIntent } from "./types";

/**
 * What the component needs back: the four elements the simulation writes to,
 * and whether it is in fact writing them.
 *
 * The hook creates the refs rather than accepting them, so the contract is one
 * way round: it owns every inline transform on the mascot, and the component
 * only says where each part is. Nothing else may write these elements.
 */
interface EyeMotion {
  eye: RefObject<SVGGElement | null>;
  expression: RefObject<SVGGElement | null>;
  left: RefObject<SVGCircleElement | null>;
  right: RefObject<SVGCircleElement | null>;
  /**
   * Whether the simulation owns the motion layers this frame. The component
   * turns their CSS transition off while it does — see `data-live`.
   */
  live: boolean;
}

/* How a closed lid is drawn: each eye is flattened and dropped slightly, which
 * reads as a lid coming down rather than as the eye shrinking. `pose.lid` says
 * how shut, and this says what shut looks like — which belongs to the
 * character, not to the SVG, or a canvas binding would blink differently. */
const { close: LID_CLOSE, drop: LID_DROP } = MASCOT_GEOMETRY.lid;

/* Where the two discs sit when the face is straight on. The markup draws them
 * there, so a mascot that is frozen or has never had a frame is still a face;
 * the hook writes only the difference from that rest placement. */
const REST_EYES = facingEyes(0, 0);

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * What the mascot does when the reader has asked for less motion.
 *
 * `freeze` stops the simulation: the eyes ease home and hold their state pose.
 * `settle` keeps them alive inside a widened deadzone — they still drift and
 * blink, but nothing crosses the tile or deforms.
 */
export type ReducedMotionBehaviour = "freeze" | "settle";

export interface EyeMotionOptions {
  /** Fix the run. Omit it and each mascot on the page gets its own. */
  seed?: number;
  tuning?: Partial<MascotTuning> | null;
  /** What `prefers-reduced-motion: reduce` does to this mascot. */
  reducedMotion?: ReducedMotionBehaviour;
  /**
   * The tile to live in: one of `MASCOT_SHAPES` by name, or a `TileSpec` of
   * your own. Changing it reshapes the mascot the eyes already live in rather
   * than rebuilding it, so they slide onto the new border.
   */
  shape?: MascotShapeName | TileSpec;
}

/**
 * Drives one mascot and writes it to the DOM.
 *
 * Everything about *who* the mascot is lives in `mascot.ts`; this owns only
 * the browser: a frame loop, the two preferences that should pause it, and
 * transform writes for the motion layers. That division is what lets a second
 * renderer reuse the character instead of reimplementing it.
 *
 * The places to look are also the switch: `null` is a mascot with no life of
 * its own. One argument rather than a flag beside an array, because a flag and
 * an array can disagree about whether the eyes are running.
 */
export function useEyeMotion(
  intents: readonly GazeIntent[] | null,
  options: EyeMotionOptions = {},
): EyeMotion {
  const eye = useRef<SVGGElement>(null);
  const expression = useRef<SVGGElement>(null);
  const left = useRef<SVGCircleElement>(null);
  const right = useRef<SVGCircleElement>(null);

  /* One mascot per mount. It outlives every change of gaze and tuning below,
   * which is the point: rebuilding it when its state changed would snap the
   * eyes back to the centre at the moment they are most watched. */
  const held = useRef<Mascot | null>(null);
  if (held.current === null) {
    held.current = createMascot({
      intents,
      seed: options.seed,
      tuning: options.tuning,
      shape: options.shape,
    });
  }
  const mascot = held.current;

  /* The preference has to be state rather than a value read inside the frame
   * loop, because `data-live` is derived from it and that attribute decides
   * whether the eyes ease home or teleport there. Starting at `false` keeps
   * the first server and client renders identical; the effect corrects it
   * before anything has been written, so there is nothing to jump. */
  const [reduced, setReduced] = useState(false);
  const behaviour = options.reducedMotion ?? "freeze";
  const frozen = reduced && behaviour === "freeze";
  const settling = reduced && behaviour === "settle";

  // A caller computing its points of interest passes a fresh array every
  // render, so the effects below depend on what the data says rather than on
  // which object said it. Cyclic runtime data from a plain-JS caller throws in
  // stringify; fall back to a stable key and let normalisation drop what it
  // cannot use.
  const gazeKey = stableKey(intents);
  const tuningKey = stableKey(options.tuning ?? null);
  const alive = intents !== null;

  useEffect(() => {
    let next = intents;
    if (next !== null && settling) next = ATTENTIVE_GAZE_INTENTS;
    mascot.setIntents(next);
    // The gaze data is the dependency, not the array identity; `intents` is
    // read through it deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascot, gazeKey, settling]);

  useEffect(() => {
    mascot.setTuning(settling ? SETTLED_TUNING : (options.tuning ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascot, tuningKey, settling]);

  const shapeKey = stableKey(options.shape ?? null);
  useEffect(() => {
    mascot.setShape(options.shape ?? null);
    // The shape data is the dependency, not the object identity — a caller
    // passing `{ radius: 8 }` inline would otherwise reshape every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascot, shapeKey]);

  useEffect(() => {
    const elements = [eye.current, expression.current, left.current, right.current] as const;
    const clearTransforms = () => {
      for (const element of elements) element?.style.removeProperty("transform");
    };

    if (!alive || elements.some((element) => !element)) {
      clearTransforms();
      return;
    }

    // Non-browser DOMs may lack matchMedia; without it there is no reduced
    // motion preference to honour, so the eyes simply run.
    const reducedMotion =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    /* Report the preference upward rather than acting on it here. React commits
     * the `data-live` removal before it runs this effect's cleanup, so by the
     * time cleanup clears the transforms their CSS transition is back on and
     * the eyes ease home. Clearing inside the listener would remove them while
     * `transition: none` still applied — a teleport out of the current look. */
    const handlePreference = () => setReduced(reducedMotion?.matches ?? false);
    handlePreference();
    reducedMotion?.addEventListener("change", handlePreference);

    if (reducedMotion?.matches && behaviour === "freeze") {
      clearTransforms();
      return () => reducedMotion.removeEventListener("change", handlePreference);
    }

    const [eyeElement, expressionElement, leftElement, rightElement] = elements;
    const written = ["", "", "", ""];
    let frame: number | undefined;
    let previous = 0;

    const write = (slot: number, element: SVGElement, transform: string) => {
      if (written[slot] === transform) return;
      written[slot] = transform;
      element.style.transform = transform;
    };

    const render = () => {
      const pose = mascot.pose();
      write(0, eyeElement!, `translate3d(${round(pose.x)}px, ${round(pose.y)}px, 0)`);

      // Jelly belongs to the pair as a whole. Turn foreshortening and blinking
      // do not: applying either here would pull pitched eyes toward the pair's
      // centre. Each disc gets both about its own centre below.
      write(
        1,
        expressionElement!,
        `rotate(${round(pose.angle)}deg) ` +
          `scale(${round(pose.stretch)}, ${round(pose.squash)}) ` +
          `rotate(${round(-pose.angle)}deg)`,
      );

      // `facingEyes` owns only the relationship inside the pair. Its midpoint
      // stays on the simulation origin, so pose.x/y remains the sole
      // translation of the face.
      const facing = facingEyes(pose.yaw, pose.pitch);
      write(2, leftElement!, disc(facing[0], REST_EYES[0], pose.lid));
      write(3, rightElement!, disc(facing[1], REST_EYES[1], pose.lid));
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      mascot.advance(Math.max(0, (time - previous) / 1000));
      previous = time;
      render();
    };

    const start = () => {
      if (frame !== undefined || document.hidden) return;
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    };

    const handleVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", handleVisibility);
    start();

    return () => {
      stop();
      reducedMotion?.removeEventListener("change", handlePreference);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTransforms();
    };
  }, [mascot, alive, behaviour, reduced]);

  return { eye, expression, left, right, live: alive && !frozen };
}

/* One disc of a turned face, as a transform off where the markup drew it.
 * `transform-box: fill-box` on `__disc` makes the narrowing happen about the
 * disc's own centre rather than the icon's.
 *
 * The lid is a screen-vertical scale outside the rotated projection. Keeping
 * those transforms separate prevents an almost-round eye from turning a blink
 * sideways as its projected narrowing axis rotates. The drop
 * uses the ellipse's vertical support, so its lower rim still stays fixed. */
const disc = (now: FacingEye, rest: FacingEye, lid: number) => {
  const rotation = ((now.rotation - rest.rotation) * Math.PI) / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const blinkScale = 1 - lid * LID_CLOSE;
  const verticalScale = Math.hypot(now.scaleX * sine, now.scaleY * cosine);
  const drop = lid * LID_DROP * verticalScale;
  return (
    `translate3d(${round(now.x - rest.x)}px, ${round(now.y - rest.y + drop)}px, 0) ` +
    `matrix(${round(cosine * now.scaleX)}, ${round(blinkScale * sine * now.scaleX)}, ${round(-sine * now.scaleY)}, ${round(blinkScale * cosine * now.scaleY)}, 0, 0)`
  );
};

function stableKey(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return "gisx-unserializable";
  }
}
