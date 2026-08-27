import { useEffect, useRef, type RefObject } from "react";

import { createMascot, type Mascot, type MascotTuning } from "@gisx-icon/core";
import type { GazeIntent } from "./types";

/**
 * The four elements the simulation writes to.
 *
 * The hook creates them rather than accepting them, so the contract is one
 * way round: it owns every inline transform on the mascot, and the component
 * only says where each part is. Nothing else may write these.
 */
interface EyeMotionRefs {
  eye: RefObject<SVGGElement | null>;
  expression: RefObject<SVGGElement | null>;
  pupilMotion: RefObject<SVGGElement | null>;
  pupilDilation: RefObject<SVGGElement | null>;
}

/* How a closed lid is drawn: the eye is flattened and dropped slightly, which
 * reads as a lid coming down rather than as the eye shrinking. This is the
 * renderer's geometry, not the mascot's character — `mascot.ts` says how shut
 * the lid is, and this says what shut looks like in an SVG. */
const LID_CLOSE = 0.92;
const LID_DROP = 1.6;

const round = (value: number) => Math.round(value * 1000) / 1000;

export interface EyeMotionOptions {
  /** Fix the run. Omit it and each mascot on the page gets its own. */
  seed?: number;
  tuning?: Partial<MascotTuning> | null;
}

/**
 * Drives one mascot and writes it to the DOM.
 *
 * Everything about *who* the mascot is lives in `mascot.ts`; this owns only
 * the browser: a frame loop, the two preferences that should pause it, and
 * four transform writes. That division is what lets a second renderer reuse
 * the character instead of reimplementing it.
 *
 * The places to look are also the switch: `null` is a mascot with no life of
 * its own. One argument rather than a flag beside an array, because a flag and
 * an array can disagree about whether the eye is running.
 */
export function useEyeMotion(
  intents: readonly GazeIntent[] | null,
  options: EyeMotionOptions = {},
): EyeMotionRefs {
  const eye = useRef<SVGGElement>(null);
  const expression = useRef<SVGGElement>(null);
  const pupilMotion = useRef<SVGGElement>(null);
  const pupilDilation = useRef<SVGGElement>(null);

  /* One mascot per mount. It outlives every change of gaze and tuning below,
   * which is the point: a mascot that were rebuilt when its state changed
   * would snap back to the centre at the moment it is most watched. */
  const held = useRef<Mascot | null>(null);
  if (held.current === null) {
    held.current = createMascot({ intents, seed: options.seed, tuning: options.tuning });
  }
  const mascot = held.current;

  // A caller computing its points of interest passes a fresh array every
  // render, so the effects below must depend on what the data says rather than
  // on which object said it. Cyclic runtime data from a plain-JS caller throws
  // in stringify; fall back to a stable key and let normalisation drop what it
  // cannot use.
  const gazeKey = stableKey(intents);
  const tuningKey = stableKey(options.tuning ?? null);
  const alive = intents !== null;

  useEffect(() => {
    mascot.setIntents(intents);
    // The gaze data is the dependency, not the array identity; `intents` is
    // read through it deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascot, gazeKey]);

  useEffect(() => {
    mascot.setTuning(options.tuning ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascot, tuningKey]);

  useEffect(() => {
    const elements = [
      eye.current,
      expression.current,
      pupilMotion.current,
      pupilDilation.current,
    ] as const;
    const clearTransforms = () => {
      for (const element of elements) element?.style.removeProperty("transform");
    };

    if (!alive || elements.some((element) => !element)) {
      clearTransforms();
      return;
    }

    // Non-browser DOMs may lack matchMedia; without it there is no reduced
    // motion preference to honour, so the eye simply runs.
    const reducedMotion =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    const [eyeElement, expressionElement, pupilMotionElement, pupilDilationElement] = elements;
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
      // The lid closes in the icon's frame, so it is applied outside the
      // deformation rather than multiplied into it.
      write(
        1,
        expressionElement!,
        `translate3d(0, ${round(pose.lid * LID_DROP)}px, 0) ` +
          `scaleY(${round(1 - pose.lid * LID_CLOSE)}) ` +
          `rotate(${round(pose.angle)}deg) ` +
          `scale(${round(pose.stretch)}, ${round(pose.squash)}) ` +
          `rotate(${round(-pose.angle)}deg)`,
      );
      write(
        2,
        pupilMotionElement!,
        `translate3d(${round(pose.pupilX)}px, ${round(pose.pupilY)}px, 0)`,
      );
      write(3, pupilDilationElement!, `scale(${round(pose.dilation)})`);
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      mascot.advance(Math.max(0, (time - previous) / 1000));
      previous = time;
      render();
    };

    const start = () => {
      if (frame !== undefined || document.hidden || reducedMotion?.matches) return;
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    };

    const handlePreference = () => {
      stop();
      if (reducedMotion?.matches) {
        clearTransforms();
        written.fill("");
      } else {
        start();
      }
    };
    const handleVisibility = () => (document.hidden ? stop() : start());

    reducedMotion?.addEventListener("change", handlePreference);
    document.addEventListener("visibilitychange", handleVisibility);
    start();

    return () => {
      stop();
      reducedMotion?.removeEventListener("change", handlePreference);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTransforms();
    };
  }, [mascot, alive]);

  return { eye, expression, pupilMotion, pupilDilation };
}

function stableKey(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return "gisx-unserializable";
  }
}
