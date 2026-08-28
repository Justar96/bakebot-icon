import * as stylex from "@stylexjs/stylex";

import { color } from "./tokens.stylex";

/**
 * Themes: redefinitions of one token group.
 *
 * `createTheme` produces a class that overrides the `color` variables inside
 * whatever element carries it, so a theme is applied by spreading it onto a
 * wrapper, not by toggling a global. Two axes are kept apart so they compose:
 * a surface theme (the light default, or dark) and an accent theme.
 * The compiler requires every createTheme call bound to its own `const`.
 */

export const dark = stylex.createTheme(color, {
  bg: "#0e0f12",
  panel: "#16181d",
  raised: "#1d2027",
  line: "#24272e",
  lineStrong: "#33373f",
  ink: "#ececea",
  dim: "#9a9fa8",
  faint: "#6b7078",
  accent: "#6d95ff",
  accentInk: "#0b1020",
});

export const green = stylex.createTheme(color, { accent: "#1f9d62" });
export const orange = stylex.createTheme(color, { accent: "#e5732a" });
export const red = stylex.createTheme(color, { accent: "#d83a3f" });
export const violet = stylex.createTheme(color, { accent: "#8b5cf6" });

/* `null` is the default: the tokens as `defineVars` declared them. */
export const surfaces = { light: null, dark } as const;
export const accents = { blue: null, green, orange, red, violet } as const;

export type Surface = keyof typeof surfaces;
export type Accent = keyof typeof accents;
