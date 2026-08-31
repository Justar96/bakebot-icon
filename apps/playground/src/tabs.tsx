import * as stylex from "@stylexjs/stylex";
import { useId, type KeyboardEvent, type ReactNode } from "react";

import { color, control, motion, radius, space } from "./tokens.stylex";

/**
 * A pill tab strip, and the panel it switches.
 *
 * Ported from Nexvyn/UI's subtle tabs (https://ui.nexvyn.dev/components) into
 * StyleX: a group of names on a raised strip, the chosen one lifted onto the
 * page's own ground. The reference springs the indicator between tabs with a
 * motion library; here the selection is a colour change, which is what this
 * page does everywhere else — and a strip of four dials is not a place to put
 * something moving.
 *
 * The keyboard follows the WAI-ARIA tabs pattern the reference implements:
 * arrows move along the strip and take the tab with them, Home and End jump to
 * the ends, and only the selected tab is in the tab order. It reads the DOM
 * for its neighbours rather than the list it was given, so a strip that ever
 * hides a tab keeps working.
 *
 * Sizes and timings are Fluid Functionalism's: a segmented control is its item
 * height plus its own padding, which is how a strip of tabs ends up as tall as
 * every other control (28 + 4 + 4 = 36, and 20 + 4 + 4 = 28 in a compact
 * region); and taking the strip runs on the moderate tier while a hover runs
 * on the fast one — a selection has a mark to land on, a hover does not.
 * https://www.fluidfunctionalism.com/docs/sizes
 */

/* The strip's own padding, and the item that is the control height less both
 * sides of it. Derived rather than named, so the strip stays level with the
 * fader beside it in either tier. */
const PAD = 4;
const ITEM = `calc(${control.height} - ${PAD * 2}px)`;

const s = stylex.create({
  /* The strip and its panel, held apart by `space` rather than by `control.gap`.
   * `control.gap` is the gap *inside* a control — what a button leaves between
   * its icon and its label — and a compact region takes it to 4. At 4 the strip
   * did not read as a separate thing from what it switches: both it and the
   * fader under it stand on `color.raised`, so the two touched and the pair
   * read as one grey block with a slot cut in it. This is layout, so it comes
   * from the layout scale, and it is one step wider than the gap between the
   * controls in the panel — the strip has to separate from the stack more than
   * the stack separates from itself. */
  wrap: { display: "flex", flexDirection: "column", gap: space.sm, minWidth: 0 },
  strip: {
    display: "flex",
    gap: 2,
    padding: PAD,
    borderRadius: radius.lg,
    backgroundColor: color.raised,
    userSelect: "none",
  },
  tab: {
    display: "inline-flex",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    height: ITEM,
    paddingInline: `calc(${control.padX} / 1.5)`,
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: { default: "transparent", ":hover": color.bg },
    color: { default: color.dim, ":hover": color.ink },
    fontSize: control.text,
    fontWeight: 500,
    cursor: "pointer",
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    /* Hover-as-preview on the fast preset: arriving takes `fastIn`, leaving
     * takes `fastOut`. Colour is a fade, so reduced motion keeps it. */
    transitionProperty: "background-color, color, outline-width",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  /* What the strip switches: a column of controls on the region's own gap.
   * The panel is part of the component because a tab strip whose panel had to
   * be wrapped by every caller is a component that has left a job undone —
   * and every caller would wrap it the same way. */
  panel: { display: "flex", flexDirection: "column", gap: control.gap, minWidth: 0 },
  /* Landing on a mark: the moderate tier, on the curve that settles once
   * without crossing it. The taken tab lifts to the panel colour — one step
   * off the raised strip it sits in, whatever that strip is standing on.
   * https://www.fluidfunctionalism.com/docs/surfaces */
  tabOn: {
    backgroundColor: { default: color.panel, ":hover": color.panel },
    color: color.ink,
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.critical,
  },
});

export const tabStyles = s;

export function Tabs<T extends string>({
  ariaLabel,
  items,
  value,
  onChange,
  children,
}: {
  ariaLabel: string;
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const at = tabs.findIndex((tab) => tab === document.activeElement);
    if (at === -1) return;

    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    const next =
      step !== 0
        ? tabs[(at + step + tabs.length) % tabs.length]
        : event.key === "Home"
          ? tabs[0]
          : event.key === "End"
            ? tabs[tabs.length - 1]
            : undefined;
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  };

  return (
    <div {...stylex.props(s.wrap)}>
      <div
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        role="tablist"
        {...stylex.props(s.strip)}
      >
        {items.map((item) => (
          <button
            aria-controls={`${id}-panel`}
            aria-selected={item.value === value}
            id={`${id}-${item.value}`}
            key={item.value}
            onClick={() => onChange(item.value)}
            role="tab"
            tabIndex={item.value === value ? 0 : -1}
            type="button"
            {...stylex.props(s.tab, item.value === value && s.tabOn)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`${id}-${value}`}
        id={`${id}-panel`}
        role="tabpanel"
        {...stylex.props(s.panel)}
      >
        {children}
      </div>
    </div>
  );
}
