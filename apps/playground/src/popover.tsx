import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { color, motion, radius, shadow } from "./tokens.stylex";

/**
 * The panel a trigger opens, positioned the way Fluid Functionalism's
 * `DropdownContent` is: a `side`, an `align`, and a `sideOffset` of 6.
 *
 * It is one component because two of them wanted the same four jobs —
 * position, dismiss, focus, and the lift off the page — and neither the
 * dropdown nor the colour picker wanted to own any of them.
 * https://www.fluidfunctionalism.com/docs/dropdown
 *
 * Portalled, rather than rendered where the trigger is. The composer's own
 * body is a scroller with a scroll-fade mask on it, and a mask paints its
 * whole subtree through itself: a panel nested inside would be clipped to the
 * column it opened from and dissolved at its edges. `fixed` alone escapes an
 * `overflow: hidden`, but nothing escapes a mask except leaving the subtree.
 *
 * Portalled *into the page* rather than onto the body, though. The surface is
 * a class on the page's own wrapper that redefines the colour tokens, so a
 * panel parented to `<body>` would read the light values while the page it
 * opened over was near-black. The host below is an empty div inside that
 * wrapper: far enough out to be clear of every mask and scroller, far enough
 * in to inherit the surface.
 *
 * It does not inherit the *size* tier, and that is deliberate: the composer is
 * a dense corner and asks for the compact tier, but a panel that has left that
 * corner is its own region and stands at the page's own 36.
 * https://www.fluidfunctionalism.com/docs/sizes
 *
 * Measured from the anchor each time it opens, and again on any scroll or
 * resize — the anchor lives inside a column that scrolls, so a panel that
 * measured once would come unstuck from the row it belongs to. Scroll is
 * listened for in the capture phase because that scrolling is a div's, not
 * the window's, and a scroll event does not bubble.
 *
 * The side is a preference rather than an instruction: if the panel does not
 * fit on the side it asked for and does fit opposite, it flips. Either way it
 * is then clamped into the viewport, so a panel can be wrong about its side
 * but never off the screen.
 *
 * Kept in the DOM shut, so opening and closing both animate. Reduced motion
 * drops the scale and keeps the fade, and `allow-discrete` is what lets
 * `visibility` wait for that fade instead of cutting it in half.
 */

const REDUCED = "@media (prefers-reduced-motion: reduce)";

/* Where every panel is parented. `main.tsx` puts it inside the surface. */
export const OVERLAY_HOST = "overlays";

/* How close to the edge of the window a panel may come to rest. */
const MARGIN = 8;

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const s = stylex.create({
  panel: {
    position: "fixed",
    zIndex: 60,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    borderRadius: radius.lg,
    backgroundColor: color.panel,
    /* The same single step off the page the composer's own card takes, and the
     * same token — a panel over a card is still one step, not two.
     * https://www.fluidfunctionalism.com/docs/surfaces */
    boxShadow: shadow.overlay,
    outlineStyle: "none",
    visibility: "hidden",
    opacity: 0,
    /* Toward the anchor, so the panel reads as coming out of the row that
     * opened it rather than as arriving from nowhere. */
    transform: "scale(0.97)",
    pointerEvents: "none",
    transitionProperty: {
      default: "opacity, transform, visibility",
      [REDUCED]: "opacity, visibility",
    },
    transitionDuration: motion.moderateOut,
    transitionTimingFunction: motion.ease,
    /* Without this, `visibility` — a discrete property — flips at the halfway
     * point of the transition and takes the second half of the fade with it. */
    transitionBehavior: "allow-discrete",
  },
  panelOpen: {
    visibility: "visible",
    opacity: 1,
    transform: "none",
    pointerEvents: "auto",
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.easeOut,
  },
  at: (top: number, left: number, origin: string) => ({ top, left, transformOrigin: origin }),
});

export const popoverStyles = s;

/* Where the panel goes, in viewport coordinates. Sizes come from `offset*`
 * rather than from a rect: a shut panel is scaled down, and a rect would
 * report the scaled size and place the open one 3% wrong. */
function place(
  anchor: DOMRect,
  panel: { width: number; height: number },
  side: Side,
  align: Align,
  offset: number,
) {
  const room = {
    top: anchor.top,
    bottom: window.innerHeight - anchor.bottom,
    left: anchor.left,
    right: window.innerWidth - anchor.right,
  };
  const vertical = side === "top" || side === "bottom";
  const need = (vertical ? panel.height : panel.width) + offset + MARGIN;
  const at = room[side] < need && room[OPPOSITE[side]] >= need ? OPPOSITE[side] : side;

  const cross = (start: number, end: number, size: number) =>
    align === "start" ? start : align === "end" ? end - size : start + (end - start - size) / 2;

  const top =
    at === "top"
      ? anchor.top - panel.height - offset
      : at === "bottom"
        ? anchor.bottom + offset
        : cross(anchor.top, anchor.bottom, panel.height);
  const left =
    at === "left"
      ? anchor.left - panel.width - offset
      : at === "right"
        ? anchor.right + offset
        : cross(anchor.left, anchor.right, panel.width);

  const clamp = (value: number, size: number, extent: number) =>
    Math.max(MARGIN, Math.min(value, extent - size - MARGIN));

  return {
    top: clamp(top, panel.height, window.innerHeight),
    left: clamp(left, panel.width, window.innerWidth),
    /* Grow from the edge the anchor is on. */
    origin: at === "top" ? "bottom left" : at === "bottom" ? "top left" : `top ${OPPOSITE[at]}`,
  };
}

export function Popover({
  open,
  onClose,
  anchor,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  id,
  label,
  role,
  activeDescendant,
  onKeyDown,
  style,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The row it belongs to: what it is measured from, and what it returns focus to. */
  anchor: RefObject<HTMLElement | null>;
  side?: Side;
  align?: Align;
  /** The gap between the anchor and the panel. Fluid's own default is 6. */
  sideOffset?: number;
  id?: string;
  label?: string;
  role?: string;
  activeDescendant?: string;
  /** The panel holds focus, so a caller's keyboard has to be bound to it. */
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  style?: StyleXStyles;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ top: 0, left: 0, origin: "top left" });
  /* Resolved after mount: the host is rendered by the same tree this is in, so
   * it does not exist yet the first time a closed panel renders. */
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById(OVERLAY_HOST) ?? document.body), []);

  const reposition = useCallback(() => {
    const from = anchor.current;
    const to = panel.current;
    if (!from || !to) return;
    setAt(
      place(
        from.getBoundingClientRect(),
        { width: to.offsetWidth, height: to.offsetHeight },
        side,
        align,
        sideOffset,
      ),
    );
  }, [align, anchor, side, sideOffset]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    /* The panel's own contents can change height while it is open — a format
     * strip switches a readout, a swatch row wraps — and that moves it. */
    const observer = new ResizeObserver(reposition);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  /* Keyed on `open` alone: a caller whose `onClose` is a fresh closure every
   * render must not cost the reader their focus once a frame. */
  const restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      const back = restore.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      /* Stopped here, so Escape dismisses the panel rather than also reaching
       * the page's own shortcuts behind it. */
      event.stopPropagation();
      onClose();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [anchor, onClose, open]);

  if (!host) return null;

  return createPortal(
    <div
      aria-activedescendant={activeDescendant}
      aria-label={label}
      id={id}
      inert={!open}
      onKeyDown={onKeyDown}
      ref={panel}
      role={role}
      tabIndex={-1}
      {...stylex.props(s.panel, s.at(at.top, at.left, at.origin), open && s.panelOpen, style)}
    >
      {children}
    </div>,
    host,
  );
}
