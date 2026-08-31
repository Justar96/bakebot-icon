import * as stylex from "@stylexjs/stylex";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { useHighlight, type Box } from "./highlight";
import { color, control, motion, radius } from "./tokens.stylex";

/**
 * A radio group: one choice out of a list, with the choice drawn as a fill
 * that travels to it.
 *
 * These were six toggle buttons in a grid, which is a lie about what they are:
 * a toggle says on or off about itself, and six of them side by side say
 * nothing about being one choice. A radio group says it in the markup, says it
 * to a screen reader, and gets the arrow keys for free.
 * https://www.fluidfunctionalism.com/docs/radio-group
 *
 * Two layers, both moving, and they mean different things — which is why there
 * are two rather than one. The selection is a persistent tinted fill and stays
 * where the answer is. Proximity hover is a second, quieter fill that follows
 * the pointer and fades out where the pointer leaves, so approaching an option
 * previews taking it without ever hiding which one is taken. A single layer
 * doing both would lose the answer every time the pointer moved.
 *
 * Both run on the moderate tier and settle on the critical curve: a fill that
 * overshoots has pointed at the wrong option, briefly. Reduced motion keeps
 * both fills and drops the travel — the selection still moves, it just arrives
 * without crossing the group to get there.
 *
 * The keyboard is the radio pattern rather than the button one: the group is a
 * single tab stop, arrows move the selection itself, and Home and End take the
 * ends. Wrapping, because a list of states has no natural first or last.
 */

const REDUCED = "@media (prefers-reduced-motion: reduce)";

const s = stylex.create({
  /* The items' `offsetParent`: both fills are positioned against this. */
  group: {
    position: "relative",
    display: "grid",
    gap: control.gap,
    minWidth: 0,
  },
  columns: (count: number) => ({
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
  }),
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0,
    borderRadius: radius.md,
    pointerEvents: "none",
    transitionProperty: {
      default: "transform, width, height, opacity",
      [REDUCED]: "opacity",
    },
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.critical,
  },
  /* The answer. The accent at a tenth, which is a fill a reader can see under
   * type without the type having to change colour to survive it. */
  chosen: {
    backgroundColor: `color-mix(in srgb, ${color.accent} 12%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color.accent} 32%, transparent)`,
  },
  /* The preview. Neutral, because it is not an answer yet. */
  near: { backgroundColor: color.raised, opacity: 0 },
  nearOn: { opacity: 1 },
  at: (box: Box) => ({
    transform: `translate(${box.left}px, ${box.top}px)`,
    width: box.width,
    height: box.height,
  }),
  item: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: control.gap,
    minWidth: 0,
    height: control.height,
    paddingInline: `calc(${control.padX} / 1.5)`,
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: "transparent",
    color: color.dim,
    fontSize: control.text,
    fontWeight: 500,
    textAlign: "start",
    cursor: "pointer",
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 1,
    transitionProperty: "color, font-weight",
    transitionDuration: motion.fastIn,
    transitionTimingFunction: motion.ease,
  },
  /* Taken: full ink and the weight up a step. The fill behind it says which
   * one; the weight is what makes it still legible as the answer in a
   * screenshot, on a projector, or to a reader who cannot see the tint. */
  itemOn: { color: color.ink, fontWeight: 600 },
  /* The mark. A ring that fills rather than a dot that appears, so the
   * indicator and the fill behind the row are one gesture. */
  mark: {
    position: "relative",
    flex: "none",
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    boxShadow: `inset 0 0 0 1px ${color.lineStrong}`,
    transitionProperty: "box-shadow",
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.ease,
  },
  markOn: { boxShadow: `inset 0 0 0 1.5px ${color.accent}` },
  /* Scaled from nothing rather than faded in: a dot that grows lands, a dot
   * that fades arrives from nowhere. The bounce is the system's enter curve,
   * and a transform is the one thing it is safe on. */
  dot: {
    position: "absolute",
    inset: 4,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    transform: "scale(0)",
    transitionProperty: { default: "transform", [REDUCED]: "opacity" },
    transitionDuration: motion.moderateOut,
    transitionTimingFunction: motion.ease,
    opacity: 0,
  },
  dotOn: {
    transform: "scale(1)",
    opacity: 1,
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.bounce,
  },
  label: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

export const radioGroupStyles = s;

export function RadioGroup<T extends string>({
  ariaLabel,
  items,
  value,
  onChange,
  columns = 2,
}: {
  ariaLabel: string;
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  columns?: number;
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const group = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState<T | null>(null);

  const chosen = useHighlight(group, value);
  const hovered = useHighlight(group, near);
  /* The preview fades out where it stood rather than snapping back to the
   * corner: it keeps its last box while its opacity leaves. */
  const lastNear = useRef<Box | null>(null);
  if (hovered) lastNear.current = hovered;
  const preview = hovered ?? lastNear.current;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = items.findIndex((item) => item.value === value);
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    const next =
      step !== 0
        ? items[(at + step + items.length) % items.length]
        : event.key === "Home"
          ? items[0]
          : event.key === "End"
            ? items[items.length - 1]
            : undefined;
    if (!next) return;
    event.preventDefault();
    onChange(next.value);
    group.current
      ?.querySelector<HTMLElement>(`[data-hl="${CSS.escape(next.value)}"]`)
      ?.focus({ preventScroll: true });
  };

  return (
    <div
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onPointerLeave={() => setNear(null)}
      ref={group}
      role="radiogroup"
      {...stylex.props(s.group, s.columns(columns))}
    >
      {preview ? (
        <span
          aria-hidden="true"
          {...stylex.props(s.fill, s.near, near !== null && s.nearOn, s.at(preview))}
        />
      ) : null}
      {chosen ? (
        <span aria-hidden="true" {...stylex.props(s.fill, s.chosen, s.at(chosen))} />
      ) : null}

      {items.map((item) => (
        <button
          aria-checked={item.value === value}
          data-hl={item.value}
          id={`${id}-${item.value}`}
          key={item.value}
          onClick={() => onChange(item.value)}
          onPointerEnter={() => setNear(item.value)}
          role="radio"
          /* One tab stop for the group, and it is the answer: tabbing in lands
           * on what is chosen, and the arrows do the choosing from there. */
          tabIndex={item.value === value ? 0 : -1}
          type="button"
          {...stylex.props(s.item, item.value === value && s.itemOn)}
        >
          <span aria-hidden="true" {...stylex.props(s.mark, item.value === value && s.markOn)}>
            <span {...stylex.props(s.dot, item.value === value && s.dotOn)} />
          </span>
          <span {...stylex.props(s.label)}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
