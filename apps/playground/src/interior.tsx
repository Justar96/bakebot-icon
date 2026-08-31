import * as stylex from "@stylexjs/stylex";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cue } from "./sound";
import { color, control, motion, radius } from "./tokens.stylex";

/**
 * interior.dev's components, ported to the StyleX pattern.
 *
 * The originals (https://www.interior.dev/docs) are built on the `motion`
 * library and organised around three failures they refuse to ship:
 *
 *   1. The button jumps — every state reserves its width before it gets there.
 *   2. The animation cannot be interrupted — a spring resumes from where the
 *      element actually is.
 *   3. Motion is the only channel — with reduced motion the information still
 *      arrives; the trip is optional, the destination is not.
 *
 * None of the three needs a motion library, so this port keeps the guarantees
 * and drops the dependency:
 *
 *   - Reserved width is layout, not animation: every label a control can reach
 *     is rendered into the same grid cell, so the widest one sizes the control
 *     from the start and a state change never moves the row beneath it.
 *   - Interruptibility is what CSS transitions already do — a transition
 *     retargets mid-flight, while a keyframe restarts from zero. Where the
 *     originals use a spring (the segmented pill), the spring is spelled as an
 *     overshooting cubic-bezier on a transition: same resume-anywhere
 *     behaviour, no runtime.
 *   - Reduced motion sets durations to zero and leaves every state change in
 *     place. The spinner stops spinning but the arc stays drawn; the pill
 *     stops gliding but still marks the choice. Every rule states that in a
 *     media query, including the ones whose values arrive at runtime — a
 *     StyleX style function takes the same conditional values a static style
 *     does, so nothing here has to read `matchMedia` to find out.
 *
 * The one keyframe in the file is the spinner's rotation: a continuous loop,
 * not an interruptible transition, so restarting is not a concept it has.
 */

const REDUCED = "@media (prefers-reduced-motion: reduce)";

/* The control height is a token rather than a constant here: these two
 * buttons stand in the composer, which carries the compact tier, and a button
 * that kept its own 36 there would be the one row out of line.
 * https://www.fluidfunctionalism.com/docs/sizes */
const HOVER = "@media (hover: hover) and (pointer: fine)";

const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const s = stylex.create({
  /* ---- shared faces: every state rendered, widest one sizes ---------- */
  faceStack: {
    display: "inline-grid",
    alignItems: "center",
  },
  face: {
    gridArea: "1 / 1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap",
    opacity: 0,
    transform: "translateY(3px)",
    /* The lift is movement and the fade is not, so reduced motion keeps the
     * second and drops the first. The face still arrives; it just arrives
     * without travelling. */
    transitionProperty: { default: "opacity, transform", [REDUCED]: "opacity" },
    transitionDuration: motion.fastOut,
    transitionTimingFunction: motion.easeOut,
  },
  faceOn: {
    opacity: 1,
    transform: "translateY(0)",
    transitionDuration: motion.fastIn,
  },
  faceIdle: { color: color.ink },
  facePending: { color: color.dim },
  faceGood: { color: color.good },
  faceBad: { color: color.bad },

  /* ---- loading button ------------------------------------------------ */
  actionButton: {
    display: "inline-flex",
    alignItems: "center",
    height: control.height,
    paddingInline: control.padX,
    borderRadius: radius.md,
    backgroundColor: {
      default: color.raised,
      [HOVER]: color.line,
      ":active": color.lineStrong,
    },
    fontSize: control.text,
    fontWeight: 500,
    cursor: "pointer",
    outlineColor: color.accent,
    outlineOffset: 2,
    transitionProperty: { default: "transform", [REDUCED]: "none" },
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.easeOut,
  },
  actionButtonBusy: {
    cursor: "progress",
  },
  press: {
    transform: { default: null, ":active": "scale(0.97)" },
  },
  spinner: {
    flexShrink: 0,
    animationName: { default: spin, [REDUCED]: "none" },
    animationDuration: "850ms",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },

  /* ---- hold to confirm ----------------------------------------------- */
  hold: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    overflow: "hidden",
    height: control.height,
    paddingInline: control.padX,
    borderRadius: radius.md,
    backgroundColor: { default: color.raised, [HOVER]: color.line },
    fontSize: control.text,
    fontWeight: 500,
    cursor: "pointer",
    outlineColor: color.accent,
    outlineOffset: 2,
    touchAction: "none",
    userSelect: "none",
    transitionProperty: { default: "transform, background-color", [REDUCED]: "background-color" },
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.easeOut,
  },
  /* Borderless, so arming is a tint under the sweep rather than a red ring:
   * the same warning, said in the one channel the control has left. */
  holdArmed: {
    backgroundColor: `color-mix(in srgb, ${color.bad} 10%, transparent)`,
  },
  holdFill: {
    position: "absolute",
    inset: 0,
    backgroundColor: `color-mix(in srgb, ${color.bad} 22%, transparent)`,
    pointerEvents: "none",
  },
  /* The sweep, as a style function rather than a `style` prop. Its duration is
   * a prop and its clock changes with the phase, which is why it used to be
   * written inline — but a dynamic style takes the same conditional values a
   * static one does, so the reduced-motion branch is a media query here
   * instead of a hook reading `matchMedia`. */
  holdSweep: (covered: boolean, duration: string, easing: string) => ({
    clipPath: covered ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
    transitionProperty: { default: "clip-path", [REDUCED]: "none" },
    transitionDuration: duration,
    transitionTimingFunction: easing,
  }),
  holdFaces: {
    position: "relative",
  },

  /* ---- segmented control --------------------------------------------- */
  segmented: {
    position: "relative",
    display: "inline-flex",
    padding: 2,
    gap: 2,
    borderRadius: radius.md,
    backgroundColor: color.raised,
  },
  /* Where the pill is, measured from the active button. A style function, so
   * the element takes only `stylex.props` — the transition above still owns
   * the glide, this only names the destination. */
  segmentPillAt: (x: number, width: number) => ({
    transform: `translateX(${x}px)`,
    width,
  }),
  segmentPill: {
    position: "absolute",
    top: 2,
    left: 0,
    height: "calc(100% - 4px)",
    borderRadius: radius.sm,
    backgroundColor: color.panel,
    boxShadow: `0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px ${color.line}`,
    transitionProperty: { default: "transform, width", [REDUCED]: "none" },
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.critical,
    pointerEvents: "none",
  },
  segment: {
    position: "relative",
    height: `calc(${control.height} - 12px)`,
    paddingInline: `calc(${control.padX} - 2px)`,
    borderRadius: radius.sm,
    fontSize: control.text,
    color: { default: color.dim, [HOVER]: color.ink },
    cursor: "pointer",
    outlineColor: color.accent,
    outlineOffset: 2,
  },
  segmentOn: {
    color: { default: color.ink, [HOVER]: color.ink },
  },
});

/* ------------------------------------------------------------------ */
/* Marks                                                               */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <svg
      {...stylex.props(s.spinner)}
      aria-hidden="true"
      fill="none"
      height="12"
      viewBox="0 0 12 12"
      width="12"
    >
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path
        d="M10.5 6A4.5 4.5 0 0 0 6 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 12 12" width="12">
      <path
        d="M2.6 6.3 4.9 8.6 9.4 3.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function AlertMark() {
  return (
    <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 12 12" width="12">
      <path d="M6 2.9v3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <circle cx="6" cy="9.1" fill="currentColor" r="0.9" />
    </svg>
  );
}

function CopyMark() {
  return (
    <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 12 12" width="12">
      <rect height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" width="7" x="1.5" y="3.5" />
      <path
        d="M4 3.5V2.6A1.1 1.1 0 0 1 5.1 1.5h4.3a1.1 1.1 0 0 1 1.1 1.1v4.3a1.1 1.1 0 0 1-1.1 1.1H8.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Faces — the width-reservation trick, shared by the stateful buttons */
/* ------------------------------------------------------------------ */

type Face = {
  key: string;
  text: string;
  tone: "idle" | "pending" | "good" | "bad";
  icon?: ReactNode;
};

const TONE = {
  idle: s.faceIdle,
  pending: s.facePending,
  good: s.faceGood,
  bad: s.faceBad,
} as const;

function Faces({ faces, current }: { faces: readonly Face[]; current: string }) {
  /* The stack is aria-hidden: the button carries the live label itself, so a
   * reader announces one state, not four overlapping ones. */
  return (
    <span aria-hidden="true" {...stylex.props(s.faceStack)}>
      {faces.map((face) => (
        <span
          key={face.key}
          {...stylex.props(s.face, TONE[face.tone], face.key === current && s.faceOn)}
        >
          {face.icon}
          {face.text}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Async action state, shared by the buttons that settle               */
/* ------------------------------------------------------------------ */

export type AsyncStatus = "idle" | "pending" | "success" | "error";

function useAsyncAction({
  action,
  resetAfter = 1400,
  onError,
  onStatus,
}: {
  action: () => unknown;
  resetAfter?: number;
  onError?: (error: unknown) => void;
  onStatus?: (status: AsyncStatus) => void;
}) {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const settle = useCallback(
    (next: AsyncStatus) => {
      if (!alive.current) return;
      setStatus(next);
      onStatus?.(next);
      /* The one thing about an async button no attribute can know: whether it
       * worked. The idle it settles back to afterwards is a timer expiring, not
       * an outcome, so it says nothing. */
      if (next === "success") cue("success");
      else if (next === "error") cue("error");
      clear();
      if (next !== "idle" && resetAfter > 0) {
        timer.current = setTimeout(() => {
          if (!alive.current) return;
          setStatus("idle");
          onStatus?.("idle");
        }, resetAfter);
      }
    },
    [onStatus, resetAfter],
  );

  const run = useCallback(() => {
    if (!alive.current) return;
    clear();
    setStatus("pending");
    onStatus?.("pending");
    const finish = (next: "success" | "error") => settle(next);
    try {
      Promise.resolve(action()).then(
        () => finish("success"),
        (error: unknown) => {
          onError?.(error);
          finish("error");
        },
      );
    } catch (error) {
      onError?.(error);
      finish("error");
    }
  }, [action, onError, onStatus, settle]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clear();
    };
  }, []);

  return { status, run, pending: status === "pending" };
}

/* ------------------------------------------------------------------ */
/* LoadingButton — interior.dev's loading-button                       */
/* ------------------------------------------------------------------ */

export function LoadingButton({
  onAction,
  children,
  pendingLabel = children,
  successLabel = "Done",
  errorLabel = "Try again",
  resetAfter = 1400,
  disabled = false,
  onError,
  onStatus,
}: {
  onAction: () => unknown;
  children: string;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  resetAfter?: number;
  disabled?: boolean;
  onError?: (error: unknown) => void;
  onStatus?: (status: AsyncStatus) => void;
}) {
  const { status, run, pending } = useAsyncAction({
    action: onAction,
    resetAfter,
    onError,
    onStatus,
  });

  const label =
    status === "pending"
      ? pendingLabel
      : status === "success"
        ? successLabel
        : status === "error"
          ? errorLabel
          : children;

  const faces: readonly Face[] = [
    { key: "idle", text: children, tone: "idle" },
    { key: "pending", text: pendingLabel, tone: "pending", icon: <Spinner /> },
    { key: "success", text: successLabel, tone: "good", icon: <CheckMark /> },
    { key: "error", text: errorLabel, tone: "bad", icon: <AlertMark /> },
  ];

  return (
    <button
      {...stylex.props(s.actionButton, s.press, pending && s.actionButtonBusy)}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!pending) run();
      }}
      type="button"
    >
      <Faces current={status} faces={faces} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* CopyButton — interior.dev's copy-button                             */
/* ------------------------------------------------------------------ */

export function CopyButton({
  text,
  children = "Copy",
  copiedLabel = "Copied",
  failedLabel = "Failed",
  resetAfter = 1400,
  onError,
}: {
  text: string | (() => string);
  children?: string;
  copiedLabel?: string;
  failedLabel?: string;
  resetAfter?: number;
  onError?: (error: unknown) => void;
}) {
  const copy = useCallback(async () => {
    const value = typeof text === "function" ? text() : text;
    await navigator.clipboard.writeText(value);
  }, [text]);

  const { status, run, pending } = useAsyncAction({ action: copy, resetAfter, onError });

  const faces: readonly Face[] = [
    { key: "idle", text: children, tone: "idle", icon: <CopyMark /> },
    { key: "pending", text: children, tone: "pending", icon: <CopyMark /> },
    { key: "success", text: copiedLabel, tone: "good", icon: <CheckMark /> },
    { key: "error", text: failedLabel, tone: "bad", icon: <AlertMark /> },
  ];

  const label =
    status === "success" ? copiedLabel : status === "error" ? failedLabel : children;

  return (
    <button
      {...stylex.props(s.actionButton, s.press)}
      aria-label={label}
      onClick={() => {
        if (!pending && status !== "success") run();
      }}
      type="button"
    >
      <Faces current={status === "pending" ? "idle" : status} faces={faces} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* HoldToConfirm — interior.dev's hold-to-confirm                      */
/* ------------------------------------------------------------------ */

export function HoldToConfirm({
  onConfirm,
  children,
  holdingLabel = "Keep holding…",
  confirmedLabel = "Done",
  duration = 1800,
  resetAfter = 1400,
}: {
  onConfirm: () => void;
  children: string;
  holdingLabel?: string;
  confirmedLabel?: string;
  duration?: number;
  resetAfter?: number;
}) {
  const [phase, setPhase] = useState<"idle" | "holding" | "done">("idle");
  const pointer = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const release = useCallback(() => {
    /* Releasing early cancels: nothing happens, and the fill snaps back with
     * the fast half of the asymmetric timing — slow where the user is
     * deciding, fast where the system is responding. */
    cancelTimer();
    pointer.current = null;
    setPhase((current) => (current === "holding" ? "idle" : current));
  }, []);

  const press = useCallback(
    (id: number) => {
      /* Multi-touch protection: a second finger mid-hold is ignored rather
       * than restarting the fill or stealing the capture. */
      if (pointer.current !== null) return;
      pointer.current = id;
      setPhase("holding");
      cancelTimer();
      timer.current = setTimeout(() => {
        pointer.current = null;
        setPhase("done");
        /* A destructive thing has happened and it happened because the reader
         * held on for a second and a half. It gets the arrival cue rather than
         * the plain success one. */
        cue("arrival");
        onConfirm();
        timer.current = setTimeout(() => setPhase("idle"), resetAfter);
      }, duration);
    },
    [duration, onConfirm, resetAfter],
  );

  useEffect(() => cancelTimer, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    press(event.pointerId);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerId === pointer.current) release();
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    event.preventDefault();
    press(-1);
  };
  const onKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") release();
  };

  const holding = phase === "holding";
  const faces: readonly Face[] = [
    { key: "idle", text: children, tone: "idle" },
    { key: "holding", text: holdingLabel, tone: "bad" },
    { key: "done", text: confirmedLabel, tone: "bad", icon: <CheckMark /> },
  ];

  return (
    <button
      {...stylex.props(s.hold, s.press, holding && s.holdArmed)}
      aria-label={phase === "done" ? confirmedLabel : holding ? holdingLabel : children}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      type="button"
    >
      {/* The fill. Press sweeps it in over the hold duration on a linear
       * clock — a progress meter, not a decoration; release snaps it back in
       * 160ms. Reduced motion skips the sweep: the fill simply is there while
       * the hold runs, which is the same information without the trip. */}
      <span
        {...stylex.props(
          s.holdFill,
          holding
            ? s.holdSweep(true, `${duration}ms`, "linear")
            : s.holdSweep(phase !== "idle", motion.slowOut, motion.easeOut),
        )}
      />
      <span {...stylex.props(s.holdFaces)}>
        <Faces current={phase} faces={faces} />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* SegmentedControl — interior.dev's segmented-control                 */
/* ------------------------------------------------------------------ */

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null);

  /* The pill is measured, not guessed: wherever the active button is, the
   * pill glides there on a transition, so clicking a third option halfway
   * through a glide retargets from mid-flight — the interruptibility the
   * original gets from a spring. */
  const measure = useCallback(() => {
    const node = buttons.current[options.indexOf(value)];
    if (!node) return;
    setPill((current) =>
      current && current.x === node.offsetLeft && current.width === node.offsetWidth
        ? current
        : { x: node.offsetLeft, width: node.offsetWidth },
    );
  }, [options, value]);

  useLayoutEffect(measure, [measure]);

  /* Fonts arriving late move every button; re-measure when they land and
   * whenever the container itself changes size. */
  useEffect(() => {
    const root = buttons.current[0]?.parentElement;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [measure]);

  const move = (direction: 1 | -1) => {
    const index = options.indexOf(value);
    const next = options[(index + direction + options.length) % options.length]!;
    onChange(next);
    buttons.current[options.indexOf(next)]?.focus();
  };

  return (
    <div
      aria-label={ariaLabel}
      role="radiogroup"
      {...stylex.props(s.segmented)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {/* Rendered only once measured, so the first paint has the pill already
       * in place instead of gliding in from nowhere. */}
      {pill && (
        <span {...stylex.props(s.segmentPill, s.segmentPillAt(pill.x, pill.width))} />
      )}
      {options.map((option, index) => (
        <button
          key={option}
          {...stylex.props(s.segment, option === value && s.segmentOn)}
          aria-checked={option === value}
          onClick={() => onChange(option)}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          role="radio"
          tabIndex={option === value ? 0 : -1}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

