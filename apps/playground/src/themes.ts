import * as stylex from "@stylexjs/stylex";

import { color, control, shadow, syntax } from "./tokens.stylex";

/**
 * The dark surface: one redefinition of one token group.
 *
 * A plain module, deliberately. `*.stylex.ts` files are for defining variables
 * and nothing else, and this file also exports the map the picker reads;
 * `createTheme`, unlike `defineVars`, may be called anywhere.
 *
 * `createTheme` produces a class that overrides the `color` variables inside
 * whatever element carries it, so a theme is applied by spreading it onto a
 * wrapper rather than by toggling a global. There is one axis and one group,
 * which is the whole of the theming here: light or dark, and nothing else to
 * choose.
 *
 * It is not a single theme with a `prefers-color-scheme` branch — StyleX
 * supports exactly that, and it is the right tool when dark mode *is* the
 * system preference, but here the surface is a control the reader operates,
 * and the media query would go on answering the operating system after they
 * had chosen otherwise. The preference picks the opening value instead.
 */

const darkColors = stylex.createTheme(color, {
  bg: stylex.types.color("#0e0f12"),
  panel: stylex.types.color("#16181d"),
  raised: stylex.types.color("#1d2027"),
  line: stylex.types.color("#2b2f38"),
  /* The same 3:1 the light surface now holds, solved against `raised` here
   * for the same reason: this draws the edges of controls, not dividers. */
  lineStrong: stylex.types.color("#666a72"),
  /* Cool, like the rest of this column.
   *
   * #ececea was very slightly warm (red above blue) while every grey under it
   * leans blue, so the brightest thing on the surface was the one thing on
   * the other side of neutral — headings read faintly yellow against their
   * own body text. This is the same lightness carrying the same cast as
   * `read` and `dim`, and still 14.88:1 on the panel. */
  ink: stylex.types.color("#e9ebef"),
  read: stylex.types.color("#c9cdd4"),
  dim: stylex.types.color("#9a9fa8"),
  /* Glyphs and strokes, at the 3:1 floor — 3.78:1 on `raised`, where it was
   * 3.27:1 and had no room left. */
  faint: stylex.types.color("#757a83"),
  good: stylex.types.color("#46b183"),
  bad: stylex.types.color("#e5635f"),
  accent: stylex.types.color("#6d95ff"),
  /* Already 6.75:1 on this surface, so the text accent and the plain one are
   * the same colour here. The split exists for paper. */
  accentInk: stylex.types.color("#6d95ff"),
});

/**
 * The same lift, spelled for near-black.
 *
 * A shadow is a colour that only exists because light is being blocked, and
 * near-black blocks very little of it: the light recipe is invisible down
 * there. Fluid Functionalism's answer is to keep the shadow and go heavier
 * with it while the panel colour itself steps lighter, so both halves of the
 * elevation say the same thing. Its own group, because `createTheme` overrides
 * one group at a time.
 *
 * https://www.fluidfunctionalism.com/docs/surfaces
 */
const darkShadows = stylex.createTheme(shadow, {
  overlay: "0 1px 2px rgba(0, 0, 0, 0.45), 0 16px 40px rgba(0, 0, 0, 0.55)",
});

/**
 * The same six roles, spelled for near-black.
 *
 * GitHub's dark set, unaltered: it is already 5.8:1 or better on this panel,
 * so there is nothing to take a step down. Its own group, because
 * `createTheme` overrides one group at a time — and a group that is only ever
 * read inside a code block still has to change when the ground does.
 */
const darkSyntax = stylex.createTheme(syntax, {
  comment: stylex.types.color("#8b949e"),
  keyword: stylex.types.color("#ff7b72"),
  string: stylex.types.color("#a5d6ff"),
  constant: stylex.types.color("#79c0ff"),
  entity: stylex.types.color("#d2a8ff"),
  attr: stylex.types.color("#7ee787"),
});

/* `null` is the default: the tokens as `defineVars` declared them, which is
 * the light surface. A surface is three groups now, so it is a list rather
 * than a class — `stylex.props` takes the array as one argument. */
export const surfaces = {
  light: [null, null, null],
  dark: [darkColors, darkShadows, darkSyntax],
} as const;

export type Surface = keyof typeof surfaces;

/**
 * The compact size tier, as a region rather than a prop.
 *
 * Fluid Functionalism sizes controls at 36 by default and 28 when the region
 * is dense, and is explicit that the choice belongs to the region: wrap a
 * corner of the page in it and the button, the select, the fader and the tab
 * strip inside all step down together. `createTheme` is that wrapper here —
 * one class, carried by the composer, read by every control under it.
 *
 * Each role drops one step rather than scaling: 13 → 12 text, 16 → 14 icon,
 * 12 → 10 padding, 8 → 4 gap. https://www.fluidfunctionalism.com/docs/sizes
 */
export const compact = stylex.createTheme(control, {
  height: "28px",
  text: "12px",
  icon: "14px",
  padX: "10px",
  gap: "4px",
});
