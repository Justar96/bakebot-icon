import * as stylex from "@stylexjs/stylex";

/**
 * The design tokens, as CSS custom properties StyleX owns.
 *
 * `defineVars` is the single source: every value below compiles to a hashed
 * variable declared on `:root`, and `themes.ts` can redefine the color
 * group. Colors use `stylex.types.color` so theme overrides are type-checked.
 * The file is named `*.stylex.ts` because StyleX resolves token imports
 * statically and only permits them from files of this shape.
 */

export const color = stylex.defineVars({
  /* Three grounds, far enough apart to be three.
   *
   * The page used to be #fbfbfa against a white panel, which is 1.03:1 and
   * 1.4 points of L* — a difference you can measure and cannot see. Every
   * card was therefore held up by its hairline, on a page whose whole idea is
   * grounds rather than outlines. Dropping the paper to #f6f6f4 opens that to
   * 3.2 points, which is the same lift the dark surface already had (3.9),
   * and costs the body text nothing: ink is still 17.45:1 on it.
   *
   * `raised` goes the other way on this surface — a code chip is a well in
   * paper, not a shelf above it — and moves down with the page to keep the
   * 2.5-point step it always had. On near-black the same token steps up
   * instead, because that is where lift lives when there is no light. */
  bg: stylex.types.color("#f6f6f4"),
  panel: stylex.types.color("#ffffff"),
  raised: stylex.types.color("#efefec"),
  /* A divider between rows, and nothing that has to be found: decorative
   * rules are outside 1.4.11, so this one is judged by eye rather than by
   * ratio. Still one step firmer than it was — 1.25:1 vanished on a dim
   * panel. */
  line: stylex.types.color("#dededa"),
  /* Not a heavier divider — the edge of a control.
   *
   * This token draws the ring on an unselected radio, the border of a button,
   * the edge of a colour swatch and the fader's rail. Those are user
   * interface components, so 1.4.11 asks 3:1 of them, and #d4d4d0 was
   * 1.49:1: a control whose boundary was half as visible as the standard
   * floor. Solved against `raised`, the darkest of the three grounds it can
   * land on, so it holds on all of them. */
  lineStrong: stylex.types.color("#8a8a86"),
  ink: stylex.types.color("#111111"),
  /* Long-form body, and only that. Headings, controls and figures take `ink`;
   * a paragraph somebody reads for a minute wants one step back from it. That
   * step used to be `dim`, which is the colour a caption is set in — so the
   * explanation of a figure was drawn no darker than the label under it, and
   * the whole document read as secondary text. */
  read: stylex.types.color("#3b3b38"),
  /* Labels, captions and secondary text — the last tier that is still read.
   * Taken down a step so it keeps its 4.5 on the darkest ground rather than
   * only on the lightest: it was 4.81:1 on `raised`, which is a pass that
   * disappears the moment a ground moves. */
  dim: stylex.types.color("#656562"),
  /* Below this line nothing is read.
   *
   * `faint` is for glyphs and strokes: a select's caret, the copy mark, the
   * prompt on a field, the measurement hairlines in the drawings. That makes
   * 3:1 the bar rather than 4.5 — and #9a9a96 was 2.54:1 on `raised`, under
   * even the non-text floor, so the icons were the least visible marks on the
   * page. It lands beside `lineStrong` because both are solved to the same
   * floor against the same ground; a glyph and a hairline are one tier doing
   * one job at two geometries. */
  faint: stylex.types.color("#868682"),
  /* State tones, quiet enough to sit inside a control: the settled faces of
   * the async components (success, error) and the hold-to-confirm fill.
   *
   * Both are set as words — "Copied", and the face a component wears when it
   * has finished — so both are held to 4.5:1, and both used to miss: the
   * green at 3.12:1 and the red at 4.11:1 on `raised`. Same hues, taken down
   * until they clear it on every ground. */
  good: stylex.types.color("#15774c"),
  bad: stylex.types.color("#c62f35"),
  /* The one accent: a focus ring, a slider's track, the prompt on a copied
   * row. It is a surface value like any other now that it is not something
   * the reader picks, so it lives in this group and changes with the rest of
   * them — a blue that reads on paper is not the one that reads on near-black. */
  accent: stylex.types.color("#2f6fed"),
  /* The same accent, dark enough to be read as words.
   *
   * A rule, a ring and a track are non-text: 3:1 carries them, and the blue
   * above clears that on both surfaces (4.20:1 on paper). A label does not —
   * it needs 4.5, and the labels wearing it are the ones that must be
   * legible: the row of the contents list you are inside, and the option a
   * menu has taken. This is that blue taken down until it clears 4.5 on the
   * darkest ground as well as the lightest — 5.32:1 on the page, 5.00:1 in a
   * well. On near-black the accent already reads at 6.75:1, so the dark
   * surface redefines it to the same value it uses for everything else and
   * the pair collapses back into one colour. */
  accentInk: stylex.types.color("#245ed6"),
});

/**
 * Syntax colour, as its own group.
 *
 * Six roles and no more. The palette is GitHub's, which is the one set of
 * syntax colours that has been measured against a white and a near-black
 * ground rather than picked: every value below clears 4.5:1 on the panel it is
 * printed on, because a keyword is text and a reader is reading it. The light
 * red is taken one step down from GitHub's own — theirs is 4.2:1 on white,
 * which is under the line for the smallest type on the page.
 *
 * Punctuation is not in the group. Braces, arrows and semicolons keep
 * `color.ink`: the shape of the code already tells you where they are, and a
 * seventh colour spent on commas is a seventh colour to look past. `themes.ts`
 * carries the near-black half, the same way it carries the surface.
 */
export const syntax = stylex.defineVars({
  comment: stylex.types.color("#6e7781"),
  keyword: stylex.types.color("#c0202c"),
  string: stylex.types.color("#0a3069"),
  /* Numbers and the SCREAMING_CASE names that behave like them. */
  constant: stylex.types.color("#0550ae"),
  /* What is being called, and what is being rendered: a function name and a
   * JSX tag are the same role — the thing the line is about. */
  entity: stylex.types.color("#7a3fd4"),
  /* A JSX attribute, and an object key, which is the same word in the same
   * position doing the same job. */
  attr: stylex.types.color("#116329"),
});

export const space = stylex.defineVars({
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "40px",
  xxxl: "64px",
});

export const radius = stylex.defineVars({
  sm: "4px",
  md: "6px",
  lg: "10px",
  pill: "999px",
});

/**
 * Type: two Geist faces and the tracking that goes with them.
 *
 * Geist is drawn a little wide at text sizes and a little loose at display
 * sizes, which is why the tracking below is negative everywhere except small
 * caps. It is not one value: the larger the type, the more it wants closing
 * up, because tracking is an optical correction and the optics change with
 * the size. Small uppercase is the one case that wants the opposite — letters
 * with no descenders and no x-height contrast need the air to stay legible.
 *
 * `body` is set once on the page and inherited; the rest are applied where
 * the size departs from body.
 */
export const type = stylex.defineVars({
  family:
    '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"Geist Mono", ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',

  xs: "11px",
  /* Fluid Functionalism's `text` token: the size a control's own label is set
   * at, so every control in the page reads at one size.
   * https://www.fluidfunctionalism.com/docs/sizes */
  sm: "13px",
  md: "14px",
  lg: "17px",
  xl: "26px",

  /* Tracking, closing up as the size grows. */
  display: "-0.03em",
  tight: "-0.02em",
  body: "-0.006em",
  caps: "0.08em",
});

/**
 * Motion, on Fluid Functionalism's three springs.
 *
 * `fast` for hover and small toggles, `moderate` for something that has to
 * settle precisely, `slow` for something arriving over the page. Three
 * presets and no fourth: a component that wants its own timing has misjudged
 * its own weight, so the numbers live here rather than in the component.
 *
 * Every preset leaves faster than it arrives. An exit that takes as long as
 * its entrance reads as the interface dragging its feet on the way out, so
 * the `Out` half of each pair is the shorter one, always.
 *
 * `none` exists so a rule can opt out. Under reduced motion the movement
 * drops and the fade stays — that is the whole rule, and it is why the
 * durations below are not simply zeroed at the call sites.
 *
 * https://www.fluidfunctionalism.com/docs/motion
 */
export const motion = stylex.defineVars({
  none: "0ms",

  /* Hover, small toggles, a caret turning. */
  fastIn: "80ms",
  fastOut: "60ms",
  /* Panels, tab indicators, a switch: anything that has to land on a mark. */
  moderateIn: "160ms",
  moderateOut: "120ms",
  /* The ground itself changing, which is the one thing on this page big
   * enough to earn a quarter of a second. */
  slowIn: "240ms",
  slowOut: "160ms",

  /* The offset that keeps a crossfade from being a dissolve: the arriving
   * layer waits this long so the departing one is already on its way out. */
  stagger: "40ms",

  ease: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  /* Critically damped, spelled as a curve: settles once and does not cross
   * its mark. The moderate preset's own shape, and what a tab indicator needs
   * — an indicator that overshoots has pointed at the wrong tab, briefly. */
  critical: "cubic-bezier(0.4, 0, 0.2, 1)",
  /* The system's own enter curve, which overshoots and comes back. Kept for
   * transforms — a colour given this curve travels past the colour it was
   * going to, which reads as a flash rather than as spring. */
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
});

/**
 * The size rhythm, as one group a region can redefine.
 *
 * Fluid Functionalism sizes controls in two tiers and calls the choice a
 * region decision rather than a per-control one: a dense corner of the page
 * asks for the compact tier and everything standing in it follows, which is
 * what keeps a button, a select, a fader and a tab strip on one line whatever
 * tier they are in. So the five numbers that describe a control live here as
 * variables, `themes.ts` carries the compact redefinition, and every control
 * in the app reads the group instead of holding a literal 36.
 *
 * Default is the 36px tier; compact is 28. `icon` is a length rather than an
 * attribute because an SVG sized by `width`/`height` attributes cannot follow
 * a variable — the elements below are sized in CSS and keep their viewBox.
 *
 * https://www.fluidfunctionalism.com/docs/sizes
 */
export const control = stylex.defineVars({
  height: "36px",
  text: "13px",
  icon: "16px",
  /* The padding inside a control, and the gap between what it holds. */
  padX: "12px",
  gap: "8px",
});

/**
 * Elevation, as the one thing on this page that leaves the ground.
 *
 * Fluid Functionalism's surfaces lift a component a single step off whatever
 * it is standing on, and spells that step differently per surface: on paper a
 * shadow behind a white panel, on near-black a lighter ground *plus* a
 * heavier shadow, because a shadow alone is invisible against near-black.
 * `themes.ts` carries the dark half; the panel colour is already a token, so
 * this group only has to carry the shadow.
 *
 * https://www.fluidfunctionalism.com/docs/surfaces
 */
export const shadow = stylex.defineVars({
  /* Two layers, always: a hairline contact shadow that reads as the card
   * touching the page, and a wide soft one that reads as the distance. */
  overlay: "0 1px 2px rgba(17, 17, 17, 0.06), 0 12px 32px rgba(17, 17, 17, 0.10)",
});
