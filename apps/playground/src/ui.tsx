import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { color, motion, radius, space, type } from "./tokens.stylex";

/**
 * The playground's primitives, styled only through tokens.
 *
 * Nothing here holds a literal colour or length: a primitive reads a token, a
 * theme changes the token, and the primitive follows. That is the whole point
 * of putting the playground on StyleX — a swatch click is a theme swap, not a
 * re-render with new props.
 *
 * Motion is deliberate and sparse. Controls that are dragged or clicked all
 * day — sliders, swatches, nav — do not animate. A theme swap animates the
 * ground so the eye can follow the change; a preview replaying animates
 * because that is the thing being looked at. Reduced motion turns both off.
 */

const REDUCED = "@media (prefers-reduced-motion: reduce)";

const s = stylex.create({
  /* ---- shell -------------------------------------------------------- */
  page: {
    minHeight: "100vh",
    backgroundColor: color.bg,
    color: color.ink,
    fontFamily: type.family,
    fontSize: type.md,
    lineHeight: 1.55,
    transitionProperty: "background-color, color",
    transitionDuration: { default: motion.settle, [REDUCED]: "0ms" },
    transitionTimingFunction: motion.ease,
  },
  shell: {
    display: "grid",
    gridTemplateColumns: { default: "220px minmax(0, 1fr)", "@media (max-width: 860px)": "1fr" },
    maxWidth: "1180px",
    marginInline: "auto",
  },
  sidebar: {
    position: { default: "sticky", "@media (max-width: 860px)": "static" },
    top: 0,
    alignSelf: "start",
    height: { default: "100vh", "@media (max-width: 860px)": "auto" },
    paddingBlock: space.xl,
    paddingInline: space.lg,
    borderRightWidth: { default: 1, "@media (max-width: 860px)": 0 },
    borderRightStyle: "solid",
    borderRightColor: color.line,
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: space.sm,
    fontWeight: 600,
    fontSize: type.md,
    letterSpacing: type.tight,
  },
  brandSub: { color: color.faint, fontWeight: 400 },
  navGroup: { display: "flex", flexDirection: "column", gap: 2 },
  navLabel: {
    fontSize: type.xs,
    textTransform: "uppercase",
    letterSpacing: type.caps,
    color: color.faint,
    marginBottom: space.xs,
    paddingInline: space.sm,
  },
  navLink: {
    display: "block",
    paddingBlock: 5,
    paddingInline: space.sm,
    borderRadius: radius.md,
    fontSize: type.sm,
    color: { default: color.dim, ":hover": color.ink },
    backgroundColor: { default: "transparent", ":hover": color.raised },
    textDecoration: "none",
  },
  sidebarFoot: { marginTop: "auto", display: "flex", flexDirection: "column", gap: space.sm },
  main: {
    paddingBlock: `${space.xxl} 120px`,
    paddingInline: { default: space.xxl, "@media (max-width: 860px)": space.xl },
    maxWidth: "860px",
  },

  /* ---- text --------------------------------------------------------- */
  h1: {
    fontSize: type.xl,
    fontWeight: 600,
    letterSpacing: type.tight,
    lineHeight: 1.2,
    marginBottom: space.md,
  },
  h2: {
    fontSize: type.lg,
    fontWeight: 600,
    letterSpacing: type.tight,
    lineHeight: 1.3,
    marginBottom: space.sm,
    scrollMarginTop: space.xl,
  },
  lede: { maxWidth: "58ch", color: color.dim, fontSize: type.md },
  prose: { maxWidth: "58ch", color: color.dim, marginBottom: space.lg },
  section: { marginTop: space.xxxl },
  hint: { color: color.dim, fontSize: type.sm },
  caption: { fontSize: type.sm, color: color.dim },
  eyebrow: {
    fontSize: type.xs,
    textTransform: "uppercase",
    letterSpacing: type.caps,
    color: color.faint,
  },

  /* ---- layout ------------------------------------------------------- */
  row: { display: "flex", flexWrap: "wrap", gap: space.xl, alignItems: "flex-end" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: space.lg,
    marginTop: space.lg,
  },
  figure: { display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm },
  chips: { display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "center" },

  /* ---- preview frame: the interior.dev component demo --------------- */
  preview: {
    marginTop: space.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.line,
    borderRadius: radius.lg,
    backgroundColor: color.panel,
    overflow: "hidden",
  },
  previewStage: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: space.xl,
    paddingBlock: space.xxl,
    paddingInline: space.xl,
    minHeight: 180,
  },
  previewBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingBlock: space.sm,
    paddingInline: space.md,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.line,
    backgroundColor: color.bg,
    fontSize: type.sm,
    color: color.dim,
  },

  /* ---- controls ----------------------------------------------------- */
  panel: {
    paddingBlock: `14px ${space.lg}`,
    paddingInline: space.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.line,
    borderRadius: radius.lg,
    backgroundColor: color.panel,
  },
  legend: {
    paddingInline: 6,
    fontSize: type.xs,
    textTransform: "uppercase",
    letterSpacing: type.caps,
    color: color.faint,
  },
  slider: {
    display: "grid",
    gridTemplateColumns: "1fr 100px 44px",
    alignItems: "center",
    gap: 10,
    paddingBlock: space.xs,
    fontSize: type.sm,
  },
  sliderLabel: { color: color.dim },
  sliderInput: { width: "100%", accentColor: color.accent },
  sliderOut: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    fontFamily: type.mono,
    fontSize: type.xs,
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingInline: space.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: color.line, ":hover": color.lineStrong },
    borderRadius: radius.md,
    backgroundColor: { default: color.panel, ":hover": color.raised, ":active": color.line },
    color: color.ink,
    fontSize: type.sm,
    fontWeight: 500,
    cursor: "pointer",
    outlineColor: color.accent,
    outlineOffset: 2,
  },
  buttonOn: {
    borderColor: { default: color.ink, ":hover": color.ink },
    backgroundColor: { default: color.ink, ":hover": color.ink },
    color: color.bg,
  },
  buttonGhost: {
    borderColor: { default: "transparent", ":hover": "transparent" },
    backgroundColor: { default: "transparent", ":hover": color.raised },
    color: color.dim,
    paddingInline: space.sm,
  },
  swatch: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.lineStrong,
    borderRadius: radius.pill,
    cursor: "pointer",
    outlineOffset: 2,
  },
  swatchOn: { outline: `2px solid ${color.ink}` },
  segmented: {
    display: "inline-flex",
    padding: 2,
    gap: 2,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.raised,
  },
  segment: {
    height: 24,
    paddingInline: 10,
    borderRadius: radius.sm,
    fontSize: type.sm,
    color: { default: color.dim, ":hover": color.ink },
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  segmentOn: {
    color: { default: color.ink, ":hover": color.ink },
    backgroundColor: color.panel,
    boxShadow: `0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px ${color.line}`,
  },

  /* ---- code & tokens ------------------------------------------------ */
  pre: {
    overflowX: "auto",
    padding: space.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.line,
    borderRadius: radius.lg,
    backgroundColor: color.panel,
    fontFamily: type.mono,
    fontSize: type.sm,
    lineHeight: 1.6,
    color: color.ink,
  },
  code: {
    paddingBlock: 1,
    paddingInline: 5,
    borderRadius: radius.sm,
    backgroundColor: color.raised,
    fontFamily: type.mono,
    fontSize: "0.92em",
  },
  details: { marginTop: space.lg, color: color.dim },
  summary: { cursor: "pointer", fontSize: type.sm },
  tokenTable: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    columnGap: space.lg,
    rowGap: 6,
    alignItems: "center",
    fontSize: type.sm,
    fontFamily: type.mono,
  },
  tokenName: { color: color.ink },
  tokenValue: { color: color.dim, textAlign: "right" },
  tokenChip: {
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.line,
  },
  scaleBar: { height: 8, backgroundColor: color.accent, borderRadius: radius.sm },
});

export const styles = s;

export function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} {...stylex.props(s.section)}>
      <h2 {...stylex.props(s.h2)}>{title}</h2>
      {intro && <p {...stylex.props(s.prose)}>{intro}</p>}
      {children}
    </section>
  );
}

/** A framed demo with a caption bar: the shape interior.dev gives a component. */
export function Preview({
  note,
  actions,
  children,
}: {
  note: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(s.preview)}>
      <div {...stylex.props(s.previewStage)}>{children}</div>
      <div {...stylex.props(s.previewBar)}>
        <span>{note}</span>
        {actions && <span {...stylex.props(s.chips)}>{actions}</span>}
      </div>
    </div>
  );
}

export function Panel({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset {...stylex.props(s.panel)}>
      <legend {...stylex.props(s.legend)}>{legend}</legend>
      {children}
    </fieldset>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label {...stylex.props(s.slider)}>
      <span {...stylex.props(s.sliderLabel)}>{label}</span>
      <input
        {...stylex.props(s.sliderInput)}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <output {...stylex.props(s.sliderOut)}>{value.toFixed(2)}</output>
    </label>
  );
}

export function Button({
  on,
  ghost,
  children,
  onClick,
}: {
  on?: boolean;
  ghost?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      {...stylex.props(s.button, on && s.buttonOn, ghost && s.buttonGhost)}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" {...stylex.props(s.segmented)}>
      {options.map((option) => (
        <button
          {...stylex.props(s.segment, option === value && s.segmentOn)}
          aria-checked={option === value}
          key={option}
          onClick={() => onChange(option)}
          role="radio"
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
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
      {...stylex.props(s.swatch, on && s.swatchOn)}
      aria-label={value}
      aria-pressed={on}
      onClick={onClick}
      style={{ background: value }}
      type="button"
    />
  );
}
