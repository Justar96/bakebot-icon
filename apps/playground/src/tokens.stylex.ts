import * as stylex from "@stylexjs/stylex";

/**
 * The design tokens, as CSS custom properties StyleX owns.
 *
 * `defineVars` is the single source: every value below compiles to a hashed
 * variable declared on `:root`, and a theme in `themes.stylex.ts` redefines a
 * group at higher specificity. The defaults are a light documentation surface
 * in the manner of interior.dev — off-white ground, near-black ink, one quiet
 * accent — and the dark surface the mascot was tuned on is a theme. The file is
 * named `*.stylex.ts` because the compiler resolves token imports statically
 * and only allows that from a file of this shape.
 */

export const color = stylex.defineVars({
  bg: "#fbfbfa",
  panel: "#ffffff",
  raised: "#f3f3f1",
  line: "#e6e6e3",
  lineStrong: "#d4d4d0",
  ink: "#111111",
  dim: "#6b6b68",
  faint: "#9a9a96",
  accent: "#2f6fed",
  accentInk: "#ffffff",
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

export const type = stylex.defineVars({
  family:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
  xs: "11px",
  sm: "12.5px",
  md: "14px",
  lg: "16px",
  xl: "24px",
  caps: "0.06em",
  tight: "-0.015em",
});

/**
 * Motion, held to Emil Kowalski's rule: animate only what the user needs to
 * see, keep it under 300ms, and never on something used hundreds of times a
 * day. Two durations are enough. `none` exists so a rule can opt out.
 */
export const motion = stylex.defineVars({
  quick: "120ms",
  settle: "220ms",
  ease: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
});
