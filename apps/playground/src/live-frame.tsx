import {
  ATTENTIVE_GAZE_INTENTS,
  createMascot,
  mascotGeometry,
  REST_POSE,
  SETTLED_TUNING,
  STATE_GAZE,
  STATE_POSE,
  type BakebotIconState,
  type Mascot,
  type MascotGeometry,
  type MascotPose,
  type MascotShapeName,
  type MascotStatePose,
  type MascotTuning,
} from "@bakebot/core";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";

/**
 * One mascot, its numbers, and the frame they were read on.
 *
 * The spec cards need something the stage does not: the values behind the
 * pixels, changing at the rate the simulation changes them. This mounts a
 * mascot off `@bakebot/core` — the same call a renderer makes — and hands
 * every frame to whoever asked, so a card can draw the character and print the
 * arithmetic that placed it from one source.
 *
 * Nothing here re-renders React. A frame arrives sixty times a second, so the
 * live nodes below write `textContent` and `transform` straight onto their own
 * element, the way `useEyeMotion` does. React owns the layout; the clock owns
 * the values in it.
 */

/* The driver's fixed step and its clamp on a long frame, restated so a card
 * can show the arithmetic the mascot performs on the elapsed time it is
 * handed. Display only: `advance` keeps its own accumulator and is the thing
 * actually simulating — none of this is fed back into it. */
const SIM_STEP = 1 / 240;
const MAX_FRAME_DELTA = 1 / 15;

/** What one frame of the simulation looks like from outside it. */
export interface Frame {
  pose: MascotPose;
  /** Seconds the browser gave the driver, before the clamp. */
  delta: number;
  /** Fixed steps that elapsed time bought. */
  steps: number;
  totalSteps: number;
  /** Seconds simulated since the card mounted. */
  clock: number;
  /** Where between two fixed steps `pose()` interpolated: 0 to 1. */
  alpha: number;
}

/** The mascot a card is talking about, in the vocabulary the package uses. */
export interface MascotSpec {
  state: BakebotIconState;
  shape: MascotShapeName;
  color: string;
  tuning: MascotTuning;
  /** What a renderer draws for that shape. Read off the package, not re-typed. */
  geometry: MascotGeometry;
  /** The state's own departure from rest, which the simulation never touches. */
  statePose: MascotStatePose;
  /** Whether the eyes are simulating at all. `Exited` is the one that is not. */
  alive: boolean;
}

type Listener = (frame: Frame) => void;

const SpecContext = createContext<MascotSpec | null>(null);
const FrameContext = createContext<{ subscribe(listener: Listener): () => void } | null>(null);

export function useSpec(): MascotSpec {
  const spec = useContext(SpecContext);
  if (!spec) throw new Error("A spec card's contents must be inside <LiveMascot>.");
  return spec;
}

/** Take every frame. The listener may be recreated each render; it is read live. */
export function useFrames(listener: Listener): void {
  const api = useContext(FrameContext);
  const held = useRef(listener);
  held.current = listener;
  useEffect(() => api?.subscribe((frame) => held.current(frame)), [api]);
}

export function LiveMascot({
  state,
  shape,
  color,
  tuning,
  seed,
  children,
}: {
  state: BakebotIconState;
  shape: MascotShapeName;
  color: string;
  tuning: MascotTuning;
  seed?: number;
  children: ReactNode;
}) {
  const listeners = useRef<Set<Listener>>(new Set()).current;
  const latest = useRef<Frame | null>(null);
  /* The counters outlive the loop, which stops and starts as the state goes
   * dead and alive again. They count what this card has seen, not what its
   * current loop has. */
  const counters = useRef({ clock: 0, accumulator: 0, totalSteps: 0 });

  const spec = useMemo<MascotSpec>(
    () => ({
      state,
      shape,
      color,
      tuning,
      geometry: mascotGeometry(shape),
      statePose: STATE_POSE[state] ?? REST_POSE,
      alive: STATE_GAZE[state] !== null,
    }),
    [state, shape, color, tuning],
  );

  /* Settle rather than freeze, and for the reason the binding settles: a card
   * whose subject is the numbers has nothing left to show once they stop. The
   * quieter dials come from the package, so this is the same character on
   * different settings and not a second one. */
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const read = () => setReduced(query?.matches ?? false);
    read();
    query?.addEventListener("change", read);
    return () => query?.removeEventListener("change", read);
  }, []);

  /* One mascot per card, retuned rather than rebuilt. Turning a dial has to
   * answer on the next frame instead of resetting the run — the springs carry
   * over, which is the whole claim the motion card is illustrating. */
  const held = useRef<Mascot | null>(null);
  if (held.current === null) {
    held.current = createMascot({ intents: STATE_GAZE[state] ?? null, seed, shape, tuning });
  }
  const mascot = held.current;

  useEffect(() => {
    const gaze = STATE_GAZE[spec.state] ?? null;
    mascot.setIntents(gaze && reduced ? ATTENTIVE_GAZE_INTENTS : gaze);
  }, [mascot, spec.state, reduced]);

  useEffect(() => {
    mascot.setTuning(reduced ? SETTLED_TUNING : spec.tuning);
  }, [mascot, spec.tuning, reduced]);

  useEffect(() => {
    mascot.setShape(spec.shape);
  }, [mascot, spec.shape]);

  /* Late subscribers get the frame already on the table rather than waiting
   * for the next one — a card that mounts between two frames should not show
   * an empty readout for a sixtieth of a second. */
  const api = useMemo(
    () => ({
      subscribe(listener: Listener) {
        listeners.add(listener);
        if (latest.current) listener(latest.current);
        return () => void listeners.delete(listener);
      },
    }),
    [listeners],
  );

  useEffect(() => {
    const publish = (frame: Frame) => {
      latest.current = frame;
      for (const listener of listeners) listener(frame);
    };
    const count = counters.current;

    publish({
      pose: mascot.pose(),
      delta: 0,
      steps: 0,
      totalSteps: count.totalSteps,
      clock: count.clock,
      alpha: 0,
    });
    // A state whose pose has already shut the eyes has one frame and no clock.
    if (!spec.alive) return;

    let frame: number | undefined;
    let previous = performance.now();

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const delta = Math.max(0, (time - previous) / 1000);
      previous = time;
      mascot.advance(delta);

      count.accumulator += Math.min(delta, MAX_FRAME_DELTA);
      const steps = Math.floor(count.accumulator / SIM_STEP);
      count.accumulator -= steps * SIM_STEP;
      count.totalSteps += steps;
      count.clock += steps * SIM_STEP;

      publish({
        pose: mascot.pose(),
        delta,
        steps,
        totalSteps: count.totalSteps,
        clock: count.clock,
        alpha: count.accumulator / SIM_STEP,
      });
    };

    const stop = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    };
    const start = () => {
      if (frame !== undefined || document.hidden) return;
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", visibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [mascot, spec.alive, listeners]);

  return (
    <SpecContext.Provider value={spec}>
      <FrameContext.Provider value={api}>{children}</FrameContext.Provider>
    </SpecContext.Provider>
  );
}

/* ---- live nodes ------------------------------------------------------- */
/* Three of them, one per thing a frame can change: what a label reads, where a
 * group sits, and what a row in the readout says. Each writes its own element
 * and compares against what it wrote last, so a value that has not moved costs
 * nothing. */

export function LiveText({
  read,
  ...rest
}: { read: (frame: Frame, spec: MascotSpec) => string } & SVGProps<SVGTextElement>) {
  const ref = useRef<SVGTextElement>(null);
  const spec = useSpec();
  useFrames((frame) => {
    const next = read(frame, spec);
    const element = ref.current;
    if (element && element.textContent !== next) element.textContent = next;
  });
  return <text ref={ref} {...rest} />;
}

export function LiveGroup({
  read,
  children,
  ...rest
}: { read: (frame: Frame, spec: MascotSpec) => string } & SVGProps<SVGGElement>) {
  const ref = useRef<SVGGElement>(null);
  const spec = useSpec();
  useFrames((frame) => {
    const next = read(frame, spec);
    const element = ref.current;
    if (element && element.getAttribute("transform") !== next) {
      element.setAttribute("transform", next);
    }
  });
  return (
    <g ref={ref} {...rest}>
      {children}
    </g>
  );
}

export function LiveSpan({
  read,
  ...rest
}: { read: (frame: Frame, spec: MascotSpec) => string } & React.HTMLAttributes<HTMLSpanElement>) {
  const ref = useRef<HTMLSpanElement>(null);
  const spec = useSpec();
  useFrames((frame) => {
    const next = read(frame, spec);
    const element = ref.current;
    if (element && element.textContent !== next) element.textContent = next;
  });
  return <span ref={ref} {...rest} />;
}

/** Every readout on these cards is a fixed-width decimal, so nothing jitters. */
export const fixed = (value: number, places = 2): string => value.toFixed(places);
