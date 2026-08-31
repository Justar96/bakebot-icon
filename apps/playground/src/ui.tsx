import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import type { Box } from "./highlight";
import { color, control, motion, radius, space, type } from "./tokens.stylex";

/**
 * The playground's primitives, styled only through tokens.
 *
 * Nothing here holds a literal colour or length: a primitive reads a token, a
 * theme changes the token, and the primitive follows. That is why a swatch
 * click is a theme swap rather than a re-render with new props.
 *
 * Motion comes from `motion` and nowhere else — three presets from Fluid
 * Functionalism, each leaving faster than it arrives. Hover is `fast`, a
 * control settling on a mark is `moderate`, the ground changing under the
 * whole page is `slow`.
 *
 * Hover previews rather than decorates: approaching a control shows a faint
 * step toward the state clicking it would commit, so the click confirms
 * something already seen. That preview arrives on `fastIn` and withdraws on
 * `fastOut`, because a highlight that lingers after the cursor has gone reads
 * as a control that is still thinking.
 *
 * Reduced motion drops the movement and keeps the fade. A colour settling and
 * an opacity crossing are not motion, so they survive; a transform, a width,
 * or a clip sweeping is, so its property leaves the transition list rather
 * than having its duration zeroed. The state change still happens either way.
 *
 * https://www.fluidfunctionalism.com/docs/motion
 */

/* One breakpoint, not three. Below it the columns become one document and the
 * page itself scrolls; above it the sidebar and the reading scroll on their
 * own and the composer floats beside them. A halfway layout would need the
 * dials to live in two places in the DOM, and they only live in one. */
const COMPACT = "@media (max-width: 1180px)";
const MOBILE = "@media (max-width: 640px)";
const REDUCED = "@media (prefers-reduced-motion: reduce)";

/* Every column opens on a band this tall, with its first line centred in it:
 * the brand, the stage's header and the composer's first row then start on the
 * same y across three columns whose type sizes are not the same. Matching the
 * top padding instead would align the boxes and leave the text stepped. */
const HEADER = 56;

/* A contents row's own vertical padding. The document borrows it: a heading
 * jumped to has to stop on the same line as the name it was jumped to by, and
 * that line is the opening band, plus the rail's gap, plus this. */
const NAV_ROW = 6;

/* Fluid Functionalism's size rhythm is a token group now rather than two
 * constants here: `control.height` is 36 on the page and 28 inside a region
 * carrying the compact theme, and every control below reads it instead of
 * naming a number. A page reads as one product when its controls share the
 * step; a dense corner of it reads as the same product when they step down
 * together. https://www.fluidfunctionalism.com/docs/sizes */

/* That line, as a length: the offset a heading is jumped to and the offset it
 * sticks at are the same number, or the two would disagree the moment a reader
 * scrolled by hand instead of clicking. */
const NAV_LINE = `calc(${HEADER}px + ${space.xl} + ${NAV_ROW}px)`;

/* A rail's smallest useful width, and the box its contents keep once the
 * column is wider than that. It is no longer the column's width: the columns
 * changed places with the middle one, and the rails are what grows now.
 *
 * The card in the right rail keeps this box whatever the window does — a
 * composer 600px wide is a composer with 300px of nothing down the middle of
 * it — and 336 less the dock's padding on both sides is the 288 it has always
 * been. */
const RAIL = 336;

/* One measure down the middle column, and now the middle column itself. The
 * preview, the call and the prose share both edges rather than each finding
 * its own width. */
const MEASURE = 720;

const s = stylex.create({
  /* ---- shell -------------------------------------------------------- */
  page: {
    minHeight: "100vh",
    backgroundColor: color.bg,
    color: color.ink,
    fontFamily: type.family,
    fontSize: type.md,
    letterSpacing: type.body,
    lineHeight: 1.5,
    transitionProperty: "background-color, color",
    transitionDuration: motion.slowIn,
    transitionTimingFunction: motion.ease,
  },
  mascotHost: {
    "--text": color.ink,
    "--window-bg": color.bg,
  },
  lightSurface: { colorScheme: "light" },
  darkSurface: { colorScheme: "dark" },
  /* Sidebar, document, dock — locked to the viewport, with the first two
   * scrolling independently and the third holding a card that does not scroll
   * at all. The document is the only one that carries reading material, so it
   * is the only one whose scroll position means anything: the preview sits at
   * its top and comes back by scrolling back up, while the dials that change
   * the preview stay where they were in the corner.
   *
   * The reading is the fixed column and the rails are the flexible ones, which
   * is the other way round from how this started. Two fixed rails around a
   * `1fr` middle meant the middle grew with the window while the measure inside
   * it stayed 720 and stayed centred — so every pixel the window gained went
   * into two gaps between the writing and the two rails, and on a wide screen
   * the contents list and the composer sat a long way from the thing they point
   * at. Capped in the middle and flexible at the sides, the surplus goes to the
   * rails instead, and both of them stay against the reading at every width.
   * Their contents are aligned to their inner edges already.
   *
   * The middle track is `minmax(0, MEASURE)` rather than `MEASURE`: the rails
   * hold a floor of `RAIL` each, and a middle that could not yield would push
   * the layout wider than a window between this breakpoint and 1392. It yields
   * first, so the measure narrows and nothing overflows. */
  shell: {
    display: "grid",
    gridTemplateColumns: {
      default: `minmax(${RAIL}px, 1fr) minmax(0, ${MEASURE}px) minmax(${RAIL}px, 1fr)`,
      [COMPACT]: "minmax(0, 1fr)",
    },
    height: { default: "100vh", [COMPACT]: "auto" },
    overflow: { default: "hidden", [COMPACT]: "visible" },
  },

  /* ---- the sidebar --------------------------------------------------- */
  /* Each column is a scroll area now, so its chrome and its contents are two
   * rules: the ground belongs to the frame, the padding and the flow belong to
   * the thing that scrolls inside it. Padding on the frame would leave the
   * scrollbar floating inside a margin.
   *
   * No divider anywhere: the page is borderless, and the cards in the middle
   * are grounds rather than outlines. The sidebar reads as its own column
   * because the stage beside it is a panel on the page's ground; stacked, the
   * space above the document does the same job a rule was doing. */
  rail: {
    backgroundColor: color.bg,
  },
  railInner: {
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
    /* Stacked, the sidebar is a band across the top rather than a column, and
     * a nav row stretched to the full page width stops reading as a nav row. */
    alignItems: { default: "stretch", [COMPACT]: "start" },
    paddingTop: 0,
    paddingBottom: space.xl,
    paddingInline: space.lg,
  },
  railGroup: { display: "flex", flexDirection: "column", gap: 2 },
  /* The contents list hangs off the rail's inner edge, so it reads against the
   * document it points into rather than against the column it sits in.
   *
   * Shrunk to its own names rather than stretched across the rail. The rail is
   * the flexible column in this grid — it takes every pixel the window gains —
   * and a ground drawn across the whole of it would be a band, not a mark. At
   * `fit-content` every row is the width of the longest name, so the ground is
   * one size and only ever has to travel.
   *
   * `position: relative` because it is the mark's `offsetParent`: `useHighlight`
   * reads offsets, and offsets are only relative to the group if the group is
   * the thing they are offset from. */
  navGroup: {
    position: "relative",
    alignSelf: { default: "end", [COMPACT]: "start" },
    alignItems: "stretch",
    /* Nearer the document's edge than the rest of the rail's contents. It is
     * pointing at the prose, so it stands closer to it than to its own column
     * — and it needs no heading to say so. */
    marginInlineEnd: `calc(0px - ${space.sm})`,
    textAlign: "end",
  },
  /* The rail's opening band, and the brand alone in it: the surface toggle
   * moved to the composer, where the rest of what a reader can change already
   * lives. The title stays on the rail's inner edge, which is where the names
   * below it are — a column read from the right reads from the right at the
   * top of it too. */
  railHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: HEADER,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: space.sm,
    marginInlineEnd: `calc(0px - ${space.sm})`,
    fontWeight: 600,
    fontSize: type.md,
    letterSpacing: type.tight,
  },
  /* One square, one glyph, no label: the surface toggle and the composer's own
   * fold are both two-state things, and a labelled pair of segments for either
   * was a paragraph of chrome. The glyph is the state being offered, not the
   * one in use. Square on the control height, so it lines up with whatever it
   * sits beside and steps down with its region. */
  iconButton: {
    display: "inline-flex",
    flex: "none",
    alignItems: "center",
    justifyContent: "center",
    width: control.height,
    height: control.height,
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: { default: "transparent", ":hover": color.raised },
    color: { default: color.faint, ":hover": color.ink },
    fontSize: control.icon,
    lineHeight: 1,
    cursor: "pointer",
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 2,
    /* Colour is a fade and stays under reduced motion; the press is movement
     * and goes. */
    transitionProperty: {
      default: "background-color, color, transform",
      [REDUCED]: "background-color, color",
    },
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
    transform: { default: null, ":active": "scale(0.92)" },
  },
  /* Pressed, for an icon button that is a switch rather than a command. One
   * glyph either way and the colour carries the state: a music note struck
   * through is not a character, and a second glyph meaning the same thing as
   * the first is a glyph a reader has to learn. `aria-pressed` says it to
   * anyone who cannot see the colour. */
  iconButtonOn: { color: { default: color.ink, ":hover": color.ink } },
  /* `dim`: it is set beside the wordmark and it names the thing you are
   * looking at, so it is read — and `faint` is the tier below reading. */
  brandSub: { color: color.dim, fontWeight: 400 },
  /* A jump link. `zIndex` because the ground is a sibling underneath it, and
   * `data-hl` on the element is what the ground is measured from. */
  docLink: {
    position: "relative",
    zIndex: 1,
    display: "block",
    width: "100%",
    paddingBlock: NAV_ROW,
    paddingInline: space.sm,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: { default: color.dim, ":hover": color.ink },
    fontSize: type.md,
    textAlign: "end",
    textDecoration: "none",
    cursor: "pointer",
    outlineColor: color.accent,
    outlineOffset: 2,
    /* Hover-as-preview, on the fast preset: arriving under the cursor takes
     * `fastIn`, leaving takes `fastOut`. Colour is a fade, not movement, so
     * reduced motion keeps it. */
    transitionProperty: "color",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  /* The row being read. The ground behind it says which one; this is only the
   * type coming up off the rest of the list to meet it — the radio group's
   * rule, and it is also the accessible one. The blue that clears AA on the
   * page does not clear it on the ground: the tint darkens what is behind the
   * text, and `accentInk` falls from 5.08:1 to 4.36:1 the moment it is drawn
   * on its own highlight. Ink reads at 15.64:1 there and needs no such care.
   *
   * No weight change either: the list is `fit-content`, so a heavier row would
   * widen the whole column and slide every name sideways as the reader
   * scrolled past it. */
  docLinkOn: { color: color.ink },

  /* The ground the reading wears — one definition, worn twice.
   *
   * The rail marks a row with it and the document marks a heading with it, so
   * the two halves of the same answer are the same object rather than two
   * things that resemble each other. A tint at a tenth with a ring at a third,
   * which is a fill a reader can see under type without the type having to
   * change colour to survive it — the radio group's fill, reused, because the
   * page has already taught this shape once.
   *
   * A ground rather than a rule, which is the page's own rule: the cards in
   * the middle column are grounds instead of outlines, and a 2px border on the
   * one thing that tracks the reader was the page contradicting itself. */
  readingGround: {
    borderRadius: radius.md,
    backgroundColor: `color-mix(in srgb, ${color.accent} 12%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color.accent} 32%, transparent)`,
  },
  /* The rail's copy of it: one element, moved, rather than five that fade.
   * Travel is what makes it a marker — a ground that fades in place says a row
   * is current, and a ground that slides says which way the reading went.
   *
   * Settles on the critical curve: a mark that overshoots has pointed at the
   * wrong section, briefly. Reduced motion keeps the ground and drops the
   * travel, so it still marks the row — it just arrives without crossing the
   * list to get there. */
  navMark: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0,
    pointerEvents: "none",
    transitionProperty: {
      default: "transform, width, height",
      [REDUCED]: "none",
    },
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.critical,
  },
  markAt: (box: Box) => ({
    transform: `translate(${box.left}px, ${box.top}px)`,
    width: box.width,
    height: box.height,
  }),

  /* ---- the page's scrollbar ------------------------------------------- */
  /* The reading column's bar, moved out of the column and onto the edge of
   * the window. It was drawn against the document's own right edge, which on
   * this layout is 320px in from the window — a rule down the middle of the
   * page, between the writing and the dials, pointing at neither. A page has
   * one scroll position that means anything and it belongs at the outside.
   *
   * `fixed` rather than `absolute`: the frame it is a child of clips its own
   * overflow, which is what makes an overlay bar possible in the first place.
   * The numbers still line up because the column is exactly the height of the
   * viewport, so the track and the thumb agree with the frame they left.
   *
   * It clears the composer: the dock insets the card by `space.lg`, and this
   * is 10 of that 16. */
  pageScrollbar: {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
  },

  /* ---- the document -------------------------------------------------- */
  /* One scroller, preview first. Reduced motion drops the smooth scroll a doc
   * link would otherwise animate — a jump is the point, not the travel. */
  studio: { minWidth: 0 },
  studioInner: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    scrollBehavior: { default: "smooth", [REDUCED]: "auto" },
  },
  stage: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    width: "100%",
    minWidth: 0,
    maxWidth: MEASURE,
    marginInline: "auto",
    paddingTop: 0,
    paddingBottom: space.lg,
    paddingInline: space.lg,
  },
  stageBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    minHeight: HEADER,
  },
  /* The card is two decks now: the mascot, and the dials that change it.
   *
   * The state controls used to be the top group of the composer, a card in the
   * other corner of the page — so the one thing on the page you were meant to
   * try was 400px away from the thing it changed, and you watched your own
   * pointer travel instead of watching the character react. They are under it
   * now, on the same panel, close enough that the change and the reaction are
   * one glance. Nothing divides the two but the gap: the panel is borderless,
   * and a rule across it would be the only line left in the middle column. */
  stageFrame: {
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
    minHeight: 320,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.panel,
  },
  /* Where the character stands. It takes the surplus height, so the deck below
   * keeps its own size and the mascot stays centred in whatever is left. */
  stageStand: {
    display: "flex",
    flex: 1,
    flexWrap: "wrap",
    alignContent: "center",
    justifyContent: "center",
    alignItems: "center",
    gap: space.xl,
    minHeight: 160,
  },
  /* Under the card rather than on it, and in the compact tier.
   *
   * These two do not set the mascot to a state, they *put* it through a
   * sequence of them — a task that pends, lands or fails. That is a thing you
   * run at the card, not a dial on it, so it stands off the panel; and it is
   * incidental to the page, so it is the small size rather than the one the
   * scrubber inside the card is drawn at.
   *
   * A row rather than the two-up grid the composer gives a pair: stretched
   * across a 720px measure, two 28px buttons read as a banner. They take the
   * width of their own labels and sit at the start of the line. */
  stageRuns: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: control.gap,
  },
  /* One trigger at rest, with every line of code behind it. What the page is
   * showing above this is the mascot, not the wiring; and a reader who wants
   * the call wants the install line above it too. So install, import and
   * render fold away together rather than one line of JSX sitting out on its
   * own under the stage with nothing to run it. */
  readout: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    width: "100%",
    minWidth: 0,
    maxWidth: MEASURE,
    marginInline: "auto",
    paddingBlock: space.md,
    paddingInline: space.lg,
  },
  /* The three steps, in the order they are done. `lg` between steps and `sm`
   * inside one, so a caption reads as belonging to the row underneath it
   * rather than floating between two. */
  drawer: {
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
    paddingBlockStart: space.xs,
  },
  step: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    minWidth: 0,
  },
  docs: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxl,
    width: "100%",
    minWidth: 0,
    maxWidth: MEASURE,
    marginInline: "auto",
    paddingBlock: space.xl,
    paddingInline: space.lg,
  },
  /* The document's own end, and built the way its beginning is: the measure
   * carries the padding, and the thing inside it carries the ground. The
   * column opens on a panel with the mascot standing in it and closes on one
   * with the package's name in it, which is the same two edges twice.
   *
   * No rule above it. A hairline and a change of ground are two ways of saying
   * the same thing, and the ground says it better — the footer is a step off
   * the page rather than a line drawn across it. */
  colophon: {
    width: "100%",
    minWidth: 0,
    maxWidth: MEASURE,
    marginInline: "auto",
    paddingTop: space.xl,
    /* The column's own last breath, so the scroll-fade at the bottom has
     * ground to dissolve rather than the footer's last line. */
    paddingBottom: space.xxl,
    paddingInline: space.lg,
  },
  /* The step off the page. `raised` is the one token that steps the same way on
   * both surfaces — darker than the paper, lighter than the near-black — so the
   * footer contrasts with the ground without being told which ground it is on.
   * https://www.fluidfunctionalism.com/docs/surfaces */
  colophonSlab: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.xl,
    paddingBlock: space.xxl,
    paddingInline: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.raised,
    /* This is the colour the whole footer inherits — the version, the licence
     * and the sentence saying which package is which. `faint` on `raised` is
     * 2.66:1, so the one paragraph explaining the split was the least legible
     * text on the page. The name above it and the links beside it already set
     * their own; this is what is left, and it is prose. */
    color: color.dim,
    fontSize: type.sm,
    /* The ground changes under the whole page on the slow tier, and this is
     * part of the ground changing. */
    transitionProperty: "background-color, color",
    transitionDuration: motion.slowIn,
    transitionTimingFunction: motion.ease,
  },
  colophonBrand: { display: "flex", flexDirection: "column", gap: space.xs, minWidth: 0 },
  colophonName: {
    color: color.ink,
    fontSize: type.md,
    fontWeight: 600,
    letterSpacing: type.tight,
  },
  /* A column rather than a row: three names stacked read as a list of places to
   * go, and they give the slab the height a footer wants. */
  colophonLinks: {
    display: "flex",
    flex: "none",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: space.sm,
  },
  /* The same underline-on-approach the prose links have: a link in a footer is
   * a link, and it says so before it is hovered rather than after. */
  colophonLink: {
    color: { default: color.dim, ":hover": color.ink },
    textDecorationLine: "underline",
    textDecorationColor: { default: color.lineStrong, ":hover": color.ink },
    textDecorationThickness: "1px",
    textUnderlineOffset: 3,
    borderRadius: radius.sm,
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 2,
    transitionProperty: "color, text-decoration-color",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  docSection: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    /* Where the contents list starts, so the heading and its own row in that
     * list come to rest level with each other. */
    scrollMarginTop: NAV_LINE,
  },

  /* ---- the dock ------------------------------------------------------- */
  /* Where the composer stands, and nothing else. The column it used to be had
   * chrome of its own — a ground, a rule down its edge, its own scrollbar —
   * and a card that floats needs none of that: the page's own ground runs
   * under it, and the card's shadow is what separates the two.
   *
   * Inset from the top and from both of its own edges rather than filling the
   * corner.
   * The top inset is not a spacing choice: it is the height of the opening
   * band plus the stage's own gap, which is exactly where the preview's card
   * begins. So the two cards on this page start on one line, and the band
   * above them stays a clear strip carrying the brand and the stage's header
   * across the whole window with nothing floating in it.
   *
   * The card no longer stands at the window's edge: its rail grows with the
   * window and it stays against the reading, so the page's scrollbar — still
   * fixed to the window — runs down the ground beyond it rather than past it.
   *
   * Stacked, it is a band across the top of the document instead — `order`
   * moves it there, so the DOM can keep it beside the sidebar and the tab
   * order reach the dials before the reading. */
  dock: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    order: { default: 3, [COMPACT]: 0 },
    /* The rail is wider than the card now, so the card needs a box of its own
     * — and a grid item narrower than its track sits at the track's start,
     * which on this side is the edge the reading is on. */
    maxWidth: { default: RAIL, [COMPACT]: null },
    paddingTop: {
      default: `calc(${HEADER}px + ${space.md})`,
      [COMPACT]: space.xl,
    },
    paddingBottom: { default: space.xl, [COMPACT]: 0 },
    paddingInline: { default: space.xl, [COMPACT]: space.xl },
  },

  /* ---- the spec cards ------------------------------------------------ */
  /* A measured drawing, on the page rather than in a box. The section it ends
   * is already its frame, and a panel around a technical drawing reads as a
   * second one. Everything in it is either a number or a name for one, so the
   * whole thing is set in mono and the prose stays outside it. */
  spec: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    marginTop: space.md,
  },
  specHead: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
  },
  specTitle: {
    fontFamily: type.mono,
    fontSize: type.sm,
    letterSpacing: "normal",
    color: color.ink,
  },
  specNote: { fontFamily: type.mono, fontSize: type.xs, letterSpacing: "normal", color: color.dim },
  /* The drawing is capped rather than stretched: its labels are quoted in card
   * pixels, so letting it grow with the column would grow the type with it. */
  specFigure: { width: "100%", maxWidth: 440, marginInline: "auto" },
  /* Name, how it is arrived at, what it says. The middle column is the one
   * that gives up its width first — a formula can wrap, a value cannot. */
  /* One line, not a table: the drawing above carries the readings that change,
   * and this says what the section's one number is. A column of eight rows
   * under every drawing was a debug overlay, which is not what a card is. */
  specRows: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "baseline",
    columnGap: space.md,
    rowGap: space.xs,
    fontFamily: type.mono,
    fontSize: type.xs,
    letterSpacing: "normal",
    lineHeight: 1.45,
  },
  specKey: { color: color.dim },
  /* How the value is arrived at — the one line on the card that explains the
   * number beside it, so it is read rather than glanced at. */
  specFormula: { color: color.dim, minWidth: 0 },
  /* Tabular figures, because a column of readings that reflows as its digits
   * change is a column nobody can read. */
  specValue: { color: color.dim, textAlign: "end", fontVariantNumeric: "tabular-nums" },
  specLive: { color: color.ink },
  /* A filled bar in a drawing: the accent, held back so the hairlines around
   * it stay the thing being read. */
  specBar: { opacity: 0.28 },
  specPair: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xl,
  },
  specPairItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: space.sm,
  },
  /* The outline and the canvas are the same mascot at the same size, so the
   * drawing that scales with its box is pinned to the one that cannot. */
  specPairFrame: { width: 156, maxWidth: "100%" },

  /* ---- text --------------------------------------------------------- */
  /* A heading inside a section rather than one of its own: the contents list
   * points at `h2`s only, so this one is set below the prose's own size step
   * and carries its weight instead of its scale. */
  h3: {
    marginTop: space.lg,
    fontSize: type.md,
    fontWeight: 600,
    letterSpacing: type.tight,
    lineHeight: 1.3,
  },
  h1: {
    fontSize: type.xl,
    fontWeight: 600,
    letterSpacing: type.display,
    lineHeight: 1.15,
    marginBottom: space.md,
  },
  h2: {
    fontSize: type.lg,
    fontWeight: 600,
    letterSpacing: type.tight,
    lineHeight: 1.25,
    /* Shrunk to the title, so the ground hugs the words. Stretched, it would
     * be a 720-wide tinted band across the measure, which is a section header
     * on a different sort of page than this one. */
    alignSelf: "start",
    /* Room for the ground, taken straight back out of the layout: the heading
     * sits on exactly the line it sat on before, and the tint bleeds into the
     * gutter and the leading rather than pushing the document around. */
    paddingBlock: space.xs,
    paddingInline: space.sm,
    marginBlock: `calc(0px - ${space.xs})`,
    marginInline: `calc(0px - ${space.sm})`,
    borderRadius: radius.md,
    backgroundColor: "transparent",
    /* A transparent ring at rest rather than no ring: `box-shadow` animates
     * from a shadow to a shadow, and `none` is not one. */
    boxShadow: "inset 0 0 0 1px transparent",
    /* Slower than a hover. This one answers the scroll rather than the
     * pointer, and a ground snapping on in 80ms while the page moves under it
     * reads as a flicker instead of as a place. Colour is a fade, not
     * movement, so reduced motion keeps it. */
    transitionProperty: "background-color, box-shadow",
    transitionDuration: motion.moderateIn,
    transitionTimingFunction: motion.ease,
  },
  prose: { color: color.read, fontSize: type.md, lineHeight: 1.65 },
  hint: { color: color.dim, fontSize: type.sm },
  caption: { fontSize: type.sm, color: color.dim },
  /* `dim`, not `faint`. These are labels a reader has to read — the step
   * numbers in the code drawer, and the line under the stage that is the only
   * place the page says what it is currently showing. `faint` is 2.73:1 on
   * paper and 3.85:1 on near-black, which is under AA on both, and this is
   * 11px uppercase: the size that can least afford it. */
  eyebrow: {
    fontSize: type.xs,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: type.caps,
    color: color.dim,
  },
  term: { color: color.ink, fontWeight: 500 },

  /* ---- layout ------------------------------------------------------- */
  figure: { display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm },

  /* ---- controls ----------------------------------------------------- */
  /* One row, the height of a fader and built the same way: the name inside it
   * on the left, the reading on the right, and the native control stretched
   * over the whole thing at zero opacity — so the platform keeps the popup,
   * the keyboard and the touch handling. */
  select: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: control.gap,
    height: control.height,
    paddingInline: control.padX,
    borderRadius: radius.md,
    /* Borderless, so hover is the ground moving: it deepens a step rather than
     * lightening toward the panel it would otherwise vanish into. */
    backgroundColor: { default: color.raised, ":hover": color.line },
    outlineWidth: { default: 0, ":has(:focus-visible)": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 2,
    transitionProperty: "background-color, outline-width",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  selectLabel: {
    overflow: "hidden",
    color: color.ink,
    fontSize: control.text,
    fontWeight: 500,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  selectValue: {
    display: "flex",
    flex: "none",
    alignItems: "center",
    gap: control.gap,
    color: color.ink,
    fontFamily: type.mono,
    fontSize: control.text,
  },
  /* Sized in CSS rather than by the SVG's own attributes: an attribute cannot
   * read a variable, and the icon has to step down with its region. */
  selectCaret: { flex: "none", width: control.icon, height: control.icon, color: color.faint },
  selectInput: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    appearance: "none",
    borderWidth: 0,
    backgroundColor: "transparent",
    opacity: 0,
    cursor: "pointer",
    outlineStyle: "none",
  },
  /* The popup is drawn by the platform, and on some of them it inherits the
   * select's own colours — which here are transparent. Naming them on the
   * options keeps the list readable wherever that is true. */
  selectOption: { backgroundColor: color.panel, color: color.ink },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: control.gap,
    height: control.height,
    paddingInline: control.padX,
    borderRadius: radius.md,
    /* Borderless, so hover is the ground moving: it deepens a step rather than
     * lightening toward the panel it would otherwise vanish into. */
    backgroundColor: {
      default: color.raised,
      ":hover": color.line,
      ":active": color.lineStrong,
    },
    color: color.ink,
    fontSize: control.text,
    fontWeight: 500,
    cursor: "pointer",
    outlineWidth: { default: 0, ":focus-visible": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 2,
    /* Hover-as-preview, on the fast preset: arriving under the cursor takes
     * `fastIn`, leaving takes `fastOut`. Colour is a fade, so reduced motion
     * keeps it; the press is movement, so that is what it drops. */
    transitionProperty: {
      default: "background-color, color, outline-width, transform",
      [REDUCED]: "background-color, color",
    },
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
    transform: { default: null, ":active": "scale(0.97)" },
  },
  buttonOn: {
    backgroundColor: { default: color.ink, ":hover": color.ink },
    color: color.bg,
  },
  buttonFill: {
    justifyContent: "flex-start",
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  buttonGhost: {
    backgroundColor: { default: "transparent", ":hover": color.raised },
    color: color.dim,
    paddingInline: `calc(${control.padX} / 1.5)`,
  },
  swatch: {
    width: 20,
    height: 20,
    /* The one edge left on the page, and it is an inset shadow rather than a
     * border: a swatch is nothing but its colour, and a colour the shade of the
     * panel would have no shape at all without a ring. Hover darkens it to
     * where the selected outline will land, so the click confirms something
     * already seen. */
    boxShadow: {
      default: `inset 0 0 0 1px ${color.lineStrong}`,
      ":hover": `inset 0 0 0 1px ${color.ink}`,
    },
    borderRadius: radius.pill,
    cursor: "pointer",
    outlineOffset: 2,
    /* Hover-as-preview, on the fast preset: arriving under the cursor takes
     * `fastIn`, leaving takes `fastOut`. Colour is a fade, so reduced motion
     * keeps it; the press is movement, so that is what it drops. */
    transitionProperty: {
      default: "box-shadow, background-color, transform",
      [REDUCED]: "box-shadow, background-color",
    },
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
    transform: { default: null, ":active": "scale(0.92)" },
  },
  swatchOn: { outline: `2px solid ${color.ink}` },
  swatchColor: (value: string) => ({ backgroundColor: value }),

  /* ---- code & tokens ------------------------------------------------ */
  /* The trigger the code folds behind. It carries its own count, so a reader
   * decides whether to open it from what is inside rather than from the word
   * written on it. */
  summary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    width: "fit-content",
    listStyleType: "none",
    paddingBlock: space.xs,
    paddingInline: space.sm,
    marginInlineStart: `calc(0px - ${space.sm})`,
    borderRadius: radius.md,
    backgroundColor: { default: "transparent", ":hover": color.raised },
    color: color.dim,
    fontSize: type.sm,
    cursor: "pointer",
    outlineColor: color.accent,
    outlineOffset: 2,
    /* Hover-as-preview, on the fast preset: arriving under the cursor takes
     * `fastIn`, leaving takes `fastOut`. Colour is a fade, not movement, so
     * reduced motion keeps it. */
    transitionProperty: "background-color, color",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  /* The caret turns off the open flag its own button holds: StyleX writes
   * conditions for an element, not for an ancestor, and the flag is the same
   * one the transition needs anyway. */
  caret: {
    display: "inline-block",
    fontSize: type.xs,
    transitionProperty: { default: "transform", [REDUCED]: "none" },
    transitionDuration: motion.fastOut,
    transitionTimingFunction: motion.bounce,
  },
  /* The open flag carries the entrance timing as well as the angle, which is
   * how the asymmetry is spelled without a selector reaching for an ancestor:
   * turning out takes `fastIn`, falling back takes `fastOut`. */
  caretOpen: { transform: "rotate(90deg)", transitionDuration: motion.fastIn },
  /* What the fold is holding, said on the trigger itself. Tabular figures so
   * the count does not reflow the row as the dials change it. */
  summaryNote: { color: color.dim, fontVariantNumeric: "tabular-nums" },
  /* No top margin: the block is a child of a step, and the step's own gap is
   * the space above it. */
  pre: {
    overflowX: "auto",
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.panel,
    fontFamily: type.mono,
    fontSize: type.sm,
    letterSpacing: "normal",
    lineHeight: 1.6,
    color: color.ink,
  },
  /* A conventional API reference, on the reading's own ground.
   *
   * It used to be a panel with a caption band on top: a card inside a column
   * of cards, which read as a widget the writing had stopped for rather than
   * as part of the writing. Rules do the same work — the ground is the page,
   * and only the type between the rules is the table.
   *
   * Three columns instead of four, with the type under the name. Four columns
   * needed 680px of table in a 720px column, so the reference scrolled
   * sideways on the very screens it was written for; stacking the two mono
   * cells that belong together fits the measure, and the description keeps
   * everything left over. The markup stays a semantic table, and the name is
   * the row's own header. */
  propsTable: {
    width: "100%",
    marginTop: space.md,
    borderCollapse: "collapse",
    textAlign: "left",
    display: { default: "table", [MOBILE]: "block" },
  },
  /* Hidden on a phone, where each row stacks into its own block and carries
   * the one label the stack cannot imply. */
  propsHead: { display: { default: "table-header-group", [MOBILE]: "none" } },
  propsHeading: {
    paddingBlock: space.sm,
    paddingInlineStart: 0,
    paddingInlineEnd: space.lg,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: color.line,
    color: color.dim,
    fontSize: type.xs,
    fontWeight: 500,
    letterSpacing: type.caps,
    lineHeight: 1.4,
    textTransform: "uppercase",
  },
  /* Wide enough for the longest type — `MascotShapeName | TileSpec` — and for
   * the longest default, so neither mono cell wraps at the measure. */
  propNameColumn: { width: 212 },
  propDefaultColumn: { width: 124 },
  propDescriptionColumn: { paddingInlineEnd: 0 },
  propRow: {
    display: { default: "table-row", [MOBILE]: "grid" },
    rowGap: { default: 0, [MOBILE]: space.xs },
    paddingBlock: { default: 0, [MOBILE]: space.md },
    borderTopWidth: { default: 0, [MOBILE]: 1 },
    borderTopStyle: "solid",
    borderTopColor: color.line,
  },
  propCell: {
    display: { default: "table-cell", [MOBILE]: "block" },
    paddingBlock: { default: space.md, [MOBILE]: 0 },
    paddingInlineStart: 0,
    paddingInlineEnd: { default: space.lg, [MOBILE]: 0 },
    borderTopWidth: { default: 1, [MOBILE]: 0 },
    borderTopStyle: "solid",
    borderTopColor: color.line,
    verticalAlign: "top",
    textAlign: "left",
    /* A row header, so the browser would embolden it. The emphasis is the
     * accent on the name itself. */
    fontWeight: 400,
    minWidth: 0,
  },
  /* Label beside the value on a phone, where the column header is gone. */
  propDefaultCell: {
    display: { default: "table-cell", [MOBILE]: "flex" },
    alignItems: "baseline",
    columnGap: space.sm,
  },
  propDescriptionCell: {
    paddingInlineEnd: 0,
    color: color.read,
    fontSize: type.sm,
    lineHeight: 1.6,
  },
  propCellLabel: {
    display: { default: "none", [MOBILE]: "block" },
    color: color.dim,
    fontSize: type.xs,
    fontWeight: 500,
    letterSpacing: type.caps,
    lineHeight: 1.6,
    textTransform: "uppercase",
  },
  /* Name over type, one to a line: the pair reads as a signature rather than
   * as two cells that happen to be adjacent. */
  propName: {
    display: "block",
    color: color.accentInk,
    fontFamily: type.mono,
    fontSize: type.sm,
    fontWeight: 600,
    letterSpacing: "normal",
    lineHeight: 1.6,
  },
  propType: {
    display: "block",
    color: color.dim,
    fontFamily: type.mono,
    fontSize: type.sm,
    letterSpacing: "normal",
    lineHeight: 1.6,
    overflowWrap: "anywhere",
  },
  propDefault: {
    color: color.ink,
    fontFamily: type.mono,
    fontSize: type.sm,
    letterSpacing: "normal",
    lineHeight: 1.6,
    overflowWrap: "anywhere",
  },
  /* No literal to copy. Dim, so a column of real defaults is what the eye
   * catches first. */
  propDefaultNone: { color: color.dim, fontSize: type.sm, lineHeight: 1.6 },

  /* Ink rather than the paragraph's own colour.
   *
   * The blocks are lexed and coloured now, and an inline snippet that inherits
   * `prose` renders body-grey on its chip — so the page said "code is
   * coloured" in a block and "code is a phrase" in a sentence. It is not
   * lexed to match: these are a CSS declaration, two custom property names, a
   * package name and an object literal, which is four languages and no
   * grammar. Ink is what they have in common — a token, not prose. */
  code: {
    paddingBlock: 1,
    paddingInline: 5,
    borderRadius: radius.sm,
    backgroundColor: color.raised,
    color: color.ink,
    fontFamily: type.mono,
    fontSize: "0.92em",
    /* An inline snippet is one token to a reader; letting it break across a
     * line leaves half a box hanging at each margin. */
    whiteSpace: "nowrap",
  },
});

export const styles = s;

/**
 * A shape, a state, a name from a list — one row, the height of a fader.
 *
 * The native select is stretched over the row at zero opacity, so the popup,
 * the keyboard and the platform's own touch picker are all still the
 * platform's. What is drawn is the name and the current value.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div {...stylex.props(s.select)}>
      <span {...stylex.props(s.selectLabel)}>{label}</span>
      <span {...stylex.props(s.selectValue)}>
        {value}
        <svg
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
          viewBox="0 0 12 12"
          {...stylex.props(s.selectCaret)}
        >
          <path d="M3 4.75 6 7.75l3-3" />
        </svg>
      </span>
      <select
        aria-label={label}
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
        {...stylex.props(s.selectInput)}
      >
        {options.map((option) => (
          <option key={option} value={option} {...stylex.props(s.selectOption)}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Button({
  on,
  ghost,
  fill,
  children,
  onClick,
}: {
  /** Pressed. Passing it at all makes this a toggle, and says so to a reader. */
  on?: boolean;
  ghost?: boolean;
  /** Take the whole cell, and start the label at its edge. */
  fill?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      {...stylex.props(s.button, fill && s.buttonFill, on && s.buttonOn, ghost && s.buttonGhost)}
      aria-pressed={on}
      /* The press and the release, off cuelume's delegated listeners. They are
       * properties of the control rather than of what it does, which is why
       * they are spelled here once instead of at every call site.
       * https://cuelume-site.pages.dev/docs/ */
      data-cuelume-press
      data-cuelume-release
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function Swatch({
  value,
  on,
  onClick,
}: {
  value: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      {...stylex.props(s.swatch, s.swatchColor(value), on && s.swatchOn)}
      aria-label={value}
      aria-pressed={on}
      onClick={onClick}
      type="button"
    />
  );
}
