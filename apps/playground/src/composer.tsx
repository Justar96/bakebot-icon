import * as stylex from "@stylexjs/stylex";
import { useId, type ReactNode } from "react";

import { ScrollArea } from "./scroll-area";
import { color, control, motion, radius, space, type } from "./tokens.stylex";

/**
 * The composer: every dial the page has, as one card in the top right corner.
 *
 * It was a 320px rail running the full height of the window, which is a lot of
 * column for eleven controls — most of it empty, and all of it competing with
 * the document for the reader's eye. Fluid Functionalism's own docs put the
 * same job in a panel: a small card pinned to the corner, holding the whole of
 * what you can change about what is on the page, with a fold so it can get out
 * of the way. https://www.fluidfunctionalism.com/docs
 *
 * Three rules come with that shape, and they are the three this file spends
 * its lines on:
 *
 *   Density is the region's decision. The card carries the compact size theme
 *   and every control under it — button, select, fader, tab strip, the async
 *   buttons — steps from 36 to 28 without being told to individually. That is
 *   what makes eleven controls fit in a card instead of a column.
 *   https://www.fluidfunctionalism.com/docs/sizes
 *
 *   One step off the ground, and one step only. That step used to be a panel
 *   *and* a shadow, which is the spelling for something floating over the
 *   document — a dialog, a menu. This card does not float: it is the second
 *   panel in a three-column page, standing beside the one the mascot stands
 *   on, and the two now read the same way. So the panel colour carries the
 *   whole of the elevation, nothing is cast behind it, and nothing inside it
 *   is painted either — one flat panel, edge to edge.
 *   https://www.fluidfunctionalism.com/docs/surfaces
 *
 *   Folding is landing on a mark, so it runs on the moderate tier, opening
 *   slower than it shuts. The height animates as a grid row rather than a
 *   `max-height` guess — `0fr` to `1fr` measures the content instead of
 *   pretending to know it. Reduced motion drops the height and keeps the fade,
 *   which is the same trade every other component here makes.
 *   https://www.fluidfunctionalism.com/docs/motion
 *
 * The header says one word. It held a tinted media tile and a reading of the
 * state, the shape and the size as well, and the reading was already on the
 * page twice — the stage prints it above the mascot and the call below it
 * prints the props themselves. A card whose header repeats what is beside it
 * has spent two lines saying nothing new, so it is a name, a caret and the
 * surface toggle: the fold's handle, and nothing that has to be read.
 */

const REDUCED = "@media (prefers-reduced-motion: reduce)";
/* One breakpoint, the page's. Above it the composer is a card in the corner;
 * below it the columns stack and it is a band across the top of the document,
 * where a card floating over a single column would have nothing to float on. */
const COMPACT = "@media (max-width: 1180px)";

const s = stylex.create({
  card: {
    display: "flex",
    flexDirection: "column",
    /* Shrinks into the dock rather than out of the window: the dock is as tall
     * as the viewport, so a card with more dials than fit gives the surplus to
     * its own scroller instead of running off the bottom of the page. */
    flex: "0 1 auto",
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    maxWidth: { default: null, [COMPACT]: 560 },
    marginInline: { default: null, [COMPACT]: "auto" },
    borderRadius: radius.lg,
    backgroundColor: color.panel,
    /* The ground changes under the whole page on the slow tier, and the card
     * is part of the ground changing. */
    transitionProperty: "background-color",
    transitionDuration: motion.slowIn,
    transitionTimingFunction: motion.ease,
  },

  /* ---- the header ------------------------------------------------------ */
  /* The fold's own handle, and whatever the caller hangs beside it. The whole
   * row is the target except where the actions are, which is why the actions
   * are siblings of the button rather than inside it. */
  /* The inset is spelled as the body's own inset less the button's, so the
   * caret starts on the same 12px line as the group names and the controls
   * below it. A header indented two pixels off the column it heads reads as a
   * mistake nobody can name. */
  head: {
    display: "flex",
    alignItems: "center",
    gap: space.xs,
    paddingInline: `calc(${space.md} - ${space.xs})`,
    paddingBlock: space.xs,
  },
  disclosure: {
    display: "flex",
    flex: 1,
    alignItems: "center",
    gap: control.gap,
    minWidth: 0,
    height: control.height,
    paddingInline: space.xs,
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: { default: "transparent", ":hover": color.raised },
    color: color.ink,
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: -2,
    /* Hover-as-preview on the fast tier: the row lights before the click that
     * folds it. Colour is a fade, so reduced motion keeps it. */
    transitionProperty: "background-color, color, outline-width",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  title: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: type.caps,
    fontSize: type.xs,
    fontWeight: 500,
    color: color.dim,
    /* Fluid's card title animates its weight when the card is the one in use.
     * Open is that state here, and it is the only thing the header has left to
     * say. https://www.fluidfunctionalism.com/docs/card */
    transitionProperty: "color, font-weight",
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.ease,
  },
  titleOpen: { color: color.ink, fontWeight: 600 },
  caret: {
    flex: "none",
    color: color.faint,
    fontSize: type.xs,
    lineHeight: 1,
    transitionProperty: { default: "transform", [REDUCED]: "none" },
    transitionDuration: motion.fastOut,
    transitionTimingFunction: motion.bounce,
  },
  /* The open flag carries the timing as well as the angle: turning out takes
   * `fastIn`, falling back takes `fastOut`. */
  caretOpen: { transform: "rotate(90deg)", transitionDuration: motion.fastIn },

  /* ---- the fold -------------------------------------------------------- */
  /* `0fr` to `1fr`: the row measures the content rather than a guess at it, so
   * nothing has to be told how tall the body is. */
  fold: {
    display: "grid",
    flex: "1 1 auto",
    gridTemplateRows: "0fr",
    minHeight: 0,
    opacity: 0,
    transitionProperty: { default: "grid-template-rows, opacity", [REDUCED]: "opacity" },
    transitionDuration: motion.moderateOut,
    transitionTimingFunction: motion.critical,
  },
  foldOpen: {
    gridTemplateRows: "1fr",
    opacity: 1,
    transitionDuration: motion.moderateIn,
  },
  /* The clip the grid row needs to have anything to animate. */
  foldInner: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
  },
  /* One gap between groups and one inside them, and the outer is twice the
   * inner: 16 apart, 8 together. It used to be 12 from this gap *plus* 12 of
   * the group's own padding, which was the divider's old clearance still being
   * paid for after the divider went — 24 between groups and 4 inside them, so
   * a group read as four loose rows rather than as one block. */
  bodyInner: {
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    paddingInline: space.md,
  },
  /* Under the scroller rather than in it: the reset and the shortcuts are the
   * card's own footer, and a footer that scrolls away is a footer nobody finds.
   *
   * No ground of its own, and this is the second time that has been settled.
   * A rule across it was the first answer and went with every other border on
   * the page. A step down to `color.bg` was the second, and `color.bg` is the
   * page — so a band of it across the bottom of the card read as the card
   * ending above the reset button, which put the one destructive control on
   * the page outside the panel it belongs to. On paper there is no third
   * option: `bg`, `panel` and `raised` sit inside three percent of each other,
   * so any recess deep enough to see is deep enough to look like the page.
   * Padding separates it, and the panel runs edge to edge. */
  foot: {
    display: "flex",
    flex: "none",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    padding: space.md,
  },

  /* ---- a group inside it ----------------------------------------------- */
  /* A name in small caps and the controls under it. Nothing of its own holds
   * it off the group above — `bodyInner`'s gap does that, so a group added or
   * removed cannot leave a space with nothing on one side of it, and there is
   * no first-child case to spell. */
  group: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
  },
  /* `dim`, not `faint`. Eleven pixels of tracked-out uppercase is the hardest
   * type on the page to read and `faint` gives it 2.6:1 on paper — under the
   * 4.5 that text of any size owes a reader. This is 5.1. */
  groupLabel: {
    fontSize: type.xs,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: type.caps,
    color: color.dim,
  },
  /* Two of anything, on one line and the same width. A wrapped row of names of
   * different lengths leaves a ragged block and a new layout every time a name
   * changes; a grid gives every option the same target and the same edge. */
  pair: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: control.gap,
  },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: control.gap },

  /* ---- the shortcut hints ---------------------------------------------- */
  keys: { display: "flex", flex: "none", alignItems: "center", gap: space.xs },
  kbd: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 18,
    height: 18,
    paddingInline: 4,
    borderRadius: radius.sm,
    backgroundColor: color.raised,
    /* A keycap is a letter you have to read to press it, at `type.xs` on the
     * darkest ground — the one place that can least afford the tier below
     * reading. */
    color: color.dim,
    fontFamily: type.mono,
    fontSize: type.xs,
    lineHeight: 1,
  },
});

export const composerStyles = s;

/** One named block of controls. */
export function ComposerGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(s.group)}>
      <span {...stylex.props(s.groupLabel)}>{label}</span>
      {children}
    </div>
  );
}

export function Composer({
  open,
  onOpenChange,
  actions,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Beside the fold's handle, and outside it: a control, not a second handle. */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");

  return (
    <section {...stylex.props(s.card)}>
      <header {...stylex.props(s.head)}>
        <button
          aria-controls={`${id}-body`}
          aria-expanded={open}
          data-cuelume-toggle
          onClick={() => onOpenChange(!open)}
          type="button"
          {...stylex.props(s.disclosure)}
        >
          <span aria-hidden="true" {...stylex.props(s.caret, open && s.caretOpen)}>
            ▶
          </span>
          <span {...stylex.props(s.title, open && s.titleOpen)}>Customize</span>
        </button>
        {actions}
      </header>

      {/* Kept in the DOM through the fold, so the height has two ends to
          travel between — and made `inert` while it is shut, so a closed panel
          cannot be tabbed into or read out. */}
      <div
        id={`${id}-body`}
        inert={!open}
        {...stylex.props(s.fold, open && s.foldOpen)}
      >
        <div {...stylex.props(s.foldInner)}>
          <ScrollArea fade viewportStyle={s.bodyInner}>
            {children}
          </ScrollArea>
          {footer ? <div {...stylex.props(s.foot)}>{footer}</div> : null}
        </div>
      </div>
    </section>
  );
}

/**
 * The shortcuts, as keycaps in the footer.
 *
 * A panel that can be reached by name has to say so somewhere, and the footer
 * is the one strip of the card that does not scroll. Three caps and no legend:
 * what each one does is on the cap's own tooltip, because a row of three words
 * beside three letters is wider than the card and says nothing the letter and
 * one hover do not.
 */
export function Keys({ children }: { children: ReactNode }) {
  return <span {...stylex.props(s.keys)}>{children}</span>;
}

export function Key({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <kbd title={hint} {...stylex.props(s.kbd)}>
      {children}
    </kbd>
  );
}
