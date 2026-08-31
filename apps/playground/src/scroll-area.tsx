import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { color, motion, radius } from "./tokens.stylex";

/**
 * Fluid Functionalism's scrollbar, without Base UI underneath it.
 *
 * macOS hides its scrollbars until you scroll, which leaves a column with no
 * sign that there is more of it. This one is always there while there is
 * something to scroll, and quiet until you reach for it: a 4px thumb at 8% of
 * the ink, widening to 6px and 12% under the pointer, 16% while dragged. The
 * 10px track it sits in never narrows, because the track is the hit target and
 * a 4px one is a miss.
 *
 * It fades in the moment you touch or scroll the column and waits before
 * fading out, so the thumb has time to shrink back to its resting width first
 * — a fade that starts immediately would mask the shrink rather than follow
 * it. Showing is `moderateIn`, hiding is `moderateOut` behind a `moderateIn`
 * delay, which is the asymmetry every other control on this page already has.
 *
 * Hover and drag are React state rather than `:hover`, for the same reason the
 * disclosure caret is: both live on the container and the thumb is the child,
 * and StyleX writes conditions for the element itself, not for an ancestor.
 *
 * `barStyle` lets a column put its bar somewhere other than its own inner
 * edge. The reading column takes it: its scrollbar belongs at the right edge
 * of the window rather than 320px in from it, where it was a rule down the
 * middle of the page pointing at nothing. A `fixed` bar escapes the frame's
 * clip, and the two agree on where the thumb goes because the column is the
 * height of the viewport already.
 *
 * `fade` opts the column into the scroll-fade mask, which `playground.css`
 * carries: the content dissolves toward whichever edge it can still be
 * scrolled past. It is the scroller itself that is masked, and the bar is its
 * sibling rather than its child, so the thumb never fades with the content it
 * is pointing at.
 *
 * On a touch-primary device none of this renders. Native overflow scrolling
 * has momentum and rubber-banding that a measured thumb cannot reproduce, and
 * there is no pointer to reveal a scrollbar with anyway.
 *
 * https://www.fluidfunctionalism.com/docs/scrollbars
 */

const COMPACT = "@media (max-width: 1180px)";
const REDUCED = "@media (prefers-reduced-motion: reduce)";

/* Fixed surface-relative ramp. `color.ink` is already the near-black on light
 * ground and the near-white on dark, so one expression covers both surfaces
 * and the thumb never has to be told which one it is on. */
const tint = (percent: number) =>
  `color-mix(in srgb, ${color.ink} ${percent}%, transparent)`;

/* How long after the last scroll event the bar counts as idle again. Long
 * enough to survive the gap between two flicks of a wheel. */
const IDLE_AFTER = 600;
const MIN_THUMB = 24;

const s = stylex.create({
  root: {
    position: "relative",
    minHeight: 0,
    /* Stacked, the column stops being its own scroller and the page takes
     * over, so the clip that makes an overlay bar possible comes off too. */
    overflow: { default: "hidden", [COMPACT]: "visible" },
  },
  viewport: {
    height: { default: "100%", [COMPACT]: "auto" },
    minHeight: 0,
    overflowY: { default: "auto", [COMPACT]: "visible" },
    /* The native bar goes; the one below replaces it. `playground.css` carries
     * the WebKit half, which is a pseudo-element StyleX does not write. */
    scrollbarWidth: "none",
  },
  bar: {
    position: "absolute",
    zIndex: 20,
    top: 0,
    right: 0,
    display: { default: "block", [COMPACT]: "none" },
    width: 10,
    height: "100%",
    touchAction: "none",
    userSelect: "none",
    pointerEvents: "none",
    opacity: 0,
    transitionProperty: "opacity",
    transitionDuration: motion.moderateOut,
    transitionDelay: motion.moderateIn,
    transitionTimingFunction: motion.easeOut,
  },
  /* Shown at once and faded out on a delay, never the other way round. */
  barOn: {
    opacity: 1,
    transitionDuration: motion.moderateIn,
    transitionDelay: motion.none,
    pointerEvents: "auto",
  },
  thumb: {
    position: "absolute",
    /* 2px off the container edge, while the track stays flush so a throw at
     * the very edge of the column still lands on something. */
    right: 3,
    width: 4,
    borderRadius: radius.pill,
    backgroundColor: tint(8),
    cursor: "default",
    transitionProperty: { default: "background-color, width", [REDUCED]: "background-color" },
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.ease,
  },
  thumbHover: { width: 6, right: 2, backgroundColor: tint(12) },
  thumbDragging: { width: 6, right: 2, backgroundColor: tint(16) },
  thumbAt: (top: number, height: number) => ({ top, height }),
});

export const scrollAreaStyles = s;

function touchPrimary() {
  return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
}

export function ScrollArea({
  as: Frame = "div",
  children,
  fade = false,
  barStyle,
  style,
  viewportStyle,
}: {
  /* The frame is whatever the column already was. Wrapping a sidebar in a
   * scroller should not cost the page its landmarks. */
  as?: "div" | "aside" | "main" | "section";
  children: ReactNode;
  /** Dissolve the content toward an edge there is still more content past. */
  fade?: boolean;
  /** Where the bar stands, if not against this column's own inner edge. */
  barStyle?: StyleXStyles;
  style?: StyleXStyles;
  viewportStyle?: StyleXStyles;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [isTouch] = useState(touchPrimary);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const [hovering, setHovering] = useState(false);
  const [overBar, setOverBar] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [dragging, setDragging] = useState(false);

  /* Where the thumb goes, from the same three numbers a browser uses. `null`
   * means there is nothing to scroll, and nothing to scroll means no bar. */
  const measure = useCallback(() => {
    const node = viewport.current;
    if (!node) return;
    const { clientHeight, scrollHeight, scrollTop } = node;
    const overflow = scrollHeight - clientHeight;
    if (overflow <= 1 || clientHeight === 0) return setThumb(null);

    const trackHeight = clientHeight - 8;
    const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * trackHeight);
    const top = 4 + (scrollTop / overflow) * (trackHeight - height);
    setThumb((current) =>
      current && current.top === top && current.height === height
        ? current
        : { top, height },
    );
  }, []);

  useEffect(() => {
    const node = viewport.current;
    if (!node || isTouch) return;
    measure();
    /* Both the column and what is in it can change size — a disclosure opens,
     * a view swaps for one with more figures — and either changes the thumb. */
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [isTouch, measure]);

  useEffect(() => () => clearTimeout(idle.current), []);

  const onScroll = () => {
    measure();
    setScrolling(true);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setScrolling(false), IDLE_AFTER);
  };

  /* Dragging maps pointer travel to scroll travel through the same ratio the
   * thumb was sized by, so the content keeps pace with the hand exactly. */
  const onThumbDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = viewport.current;
    if (!node || !thumb) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);

    const startY = event.clientY;
    const startTop = node.scrollTop;
    const trackHeight = node.clientHeight - 8;
    const travel = trackHeight - thumb.height;
    const overflow = node.scrollHeight - node.clientHeight;

    const move = (moved: PointerEvent) => {
      node.scrollTop = travel > 0
        ? startTop + ((moved.clientY - startY) / travel) * overflow
        : startTop;
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* A press on the track pages toward it, the way a native bar does. */
  const onTrackDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = viewport.current;
    if (!node || !thumb || event.target !== track.current) return;
    const y = event.clientY - track.current.getBoundingClientRect().top;
    node.scrollBy({ top: y < thumb.top ? -node.clientHeight : node.clientHeight });
  };

  if (isTouch) {
    return (
      <Frame {...stylex.props(s.root, style)}>
        <div
          data-scroll-fade={fade || undefined}
          data-slot="scroll-area-viewport"
          {...stylex.props(s.viewport, viewportStyle)}
        >
          {children}
        </div>
      </Frame>
    );
  }

  return (
    <Frame
      {...stylex.props(s.root, style)}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <div
        data-scroll-fade={fade || undefined}
        data-slot="scroll-area-viewport"
        onScroll={onScroll}
        ref={viewport}
        {...stylex.props(s.viewport, viewportStyle)}
      >
        {children}
      </div>
      {thumb && (
        <div
          onPointerDown={onTrackDown}
          onPointerEnter={() => setOverBar(true)}
          onPointerLeave={() => setOverBar(false)}
          ref={track}
          {...stylex.props(s.bar, (hovering || scrolling || dragging) && s.barOn, barStyle)}
        >
          <div
            onPointerDown={onThumbDown}
            {...stylex.props(
              s.thumb,
              s.thumbAt(thumb.top, thumb.height),
              overBar && !dragging && s.thumbHover,
              dragging && s.thumbDragging,
            )}
          />
        </div>
      )}
    </Frame>
  );
}
