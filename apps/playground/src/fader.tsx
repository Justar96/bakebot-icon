import * as stylex from "@stylexjs/stylex";

import { color, control, motion, radius, type } from "./tokens.stylex";

/**
 * A fader: the control is the display.
 *
 * Ported from Nexvyn/UI's mixing-console fader
 * (https://ui.nexvyn.dev/components/fader) into StyleX, and onto a native
 * range input. The reference is Base UI plus a motion library plus a hook that
 * measures the label and value to dodge the grab bar; what carries the design
 * is the grammar, not that machinery: the name sits inside the track, the
 * reading sits opposite it, the fill edge *is* the value, and a thin bar marks
 * the place to grab. One row instead of the three columns a label, a track and
 * a readout used to take.
 *
 * The input is stretched over the whole control at zero opacity, which is what
 * makes this a real slider rather than a picture of one: drag, click-to-jump,
 * arrows, PageUp/PageDown and Home/End are the platform's, and so is the
 * touch and pointer handling.
 *
 * The focus ring belongs to the container, not to the input: an element at zero
 * opacity draws its outline at zero opacity too, so a ring on the input would
 * never be seen. `:has(:focus-visible)` keeps it a keyboard ring rather than
 * one that flashes on every click, which is what `:focus-within` would give.
 *
 * Hover and press reach the fill and the grab bar through custom properties set
 * on the container. StyleX writes conditions for the element that carries them,
 * and both are children — a variable is the way down.
 *
 * Both ramps have three steps rather than two. The fill used to go from `line`
 * straight to `lineStrong` on hover, which is a jump of nearly 3:1: the whole
 * left half of the control fell to a mid grey, under a label set in `ink`, on
 * nothing more than a pointer passing over it. A hover is a preview, and a
 * preview that changes the control that much has already committed. So the
 * intermediate steps are mixed — there is no token between those two, and there
 * should not be one for a state this local.
 *
 * A caller may lay a `rail` along the bottom edge: a 3px strip of whatever CSS
 * paint it likes, drawn over the fill and under the face. It exists for the
 * channel of a colour — a hue fader whose track is grey is a control that will
 * not say what dragging it does — and it is a strip rather than the whole
 * ground because the name and the reading are set in `ink` *inside* this track.
 * A rainbow behind them takes the label to 2.2:1 as it passes blue, and a
 * legibility scrim over a gradient is two problems where there was one. Three
 * pixels, matching the grab bar's own width, is enough to read a ramp from.
 *
 * The bar deepens with the fill instead of holding still in it. It is the grab
 * signifier, so it has to be *more* visible the nearer the pointer gets; held
 * at `dim` it would have been the one thing that lost contrast as the fill
 * darkened under it, which is the opposite of what a signifier owes you.
 */

/* The bar's own box, on the icon step: the fill never gets narrower than
 * this, so the grab signifier stays on screen at the bottom of the range —
 * the same clamp the reference makes in `barCenterFor`. It reads the token
 * rather than a literal so the fader can stand in a compact region without
 * its grab bar staying the size it was on the page.
 * https://www.fluidfunctionalism.com/docs/sizes */
const BAR_BOX = control.icon;

const s = stylex.create({
  fader: {
    "--fader-fill": {
      default: color.line,
      ":hover": `color-mix(in srgb, ${color.lineStrong} 40%, ${color.line})`,
      ":active": `color-mix(in srgb, ${color.lineStrong} 65%, ${color.line})`,
    },
    "--fader-bar": {
      default: color.dim,
      ":hover": color.ink,
      ":active": color.ink,
    },
    position: "relative",
    display: "block",
    height: control.height,
    outlineWidth: { default: 0, ":has(:focus-visible)": 2 },
    outlineStyle: "solid",
    outlineColor: color.accent,
    outlineOffset: 2,
    borderRadius: radius.md,
    backgroundColor: color.raised,
    overflow: "hidden",
    userSelect: "none",
    transitionProperty: "outline-width",
    transitionDuration: { default: motion.fastOut, ":hover": motion.fastIn },
    transitionTimingFunction: motion.ease,
  },
  /* Filled from the left, and never below the bar's own width. */
  fill: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    minWidth: BAR_BOX,
    backgroundColor: "var(--fader-fill)",
    transitionProperty: "background-color",
    transitionDuration: motion.fastIn,
    transitionTimingFunction: motion.ease,
  },
  fillAt: (percent: number) => ({ width: `${percent}%` }),
  barBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: BAR_BOX,
    height: "100%",
    marginInlineStart: "auto",
  },
  /* Inset by the same amount top and bottom whatever tier it is in: 20 in a
   * 36 row, 12 in a 28 one. */
  bar: {
    width: 3,
    height: `calc(${control.height} - 16px)`,
    borderRadius: radius.pill,
    backgroundColor: "var(--fader-bar)",
    transitionProperty: "background-color",
    transitionDuration: motion.fastIn,
    transitionTimingFunction: motion.ease,
  },
  /* The caller's paint, along the base of the track: over the fill, so the ramp
   * is not cut in half by it, and under the face, which needs no help. */
  rail: {
    position: "absolute",
    insetInline: 0,
    insetBlockEnd: 0,
    height: 3,
    pointerEvents: "none",
  },
  railPaint: (paint: string) => ({ backgroundImage: paint }),
  /* The name and the reading, over the fill rather than beside it. */
  face: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: control.gap,
    paddingInline: control.padX,
    pointerEvents: "none",
  },
  label: {
    overflow: "hidden",
    color: color.ink,
    fontSize: control.text,
    fontWeight: 500,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  /* Tabular figures: a reading that reflows as it counts is unreadable. */
  value: {
    flex: "none",
    color: color.ink,
    fontFamily: type.mono,
    fontSize: control.text,
    fontVariantNumeric: "tabular-nums",
  },
  /* The unit is half the reading — "240" and "240 Hz" are different facts —
   * so it sits in the tier that is still read rather than the one below it. */
  unit: { color: color.dim },
  input: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    appearance: "none",
    backgroundColor: "transparent",
    opacity: 0,
    cursor: { default: "grab", ":active": "grabbing" },
    outlineStyle: "none",
  },
});

export const faderStyles = s;

export function Fader({
  label,
  value,
  min,
  max,
  step,
  unit,
  rail,
  format = (reading: number) => reading.toFixed(2),
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Written after the reading, in the quieter colour. */
  unit?: string;
  /** CSS paint for a 3px strip along the base: what this dial's range looks like. */
  rail?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const span = max - min;
  const percent = span > 0 ? ((value - min) / span) * 100 : 0;

  return (
    <div {...stylex.props(s.fader)}>
      <div {...stylex.props(s.fill, s.fillAt(percent))}>
        <span {...stylex.props(s.barBox)}>
          <span {...stylex.props(s.bar)} />
        </span>
      </div>
      {rail ? <span {...stylex.props(s.rail, s.railPaint(rail))} /> : null}
      <div {...stylex.props(s.face)}>
        <span {...stylex.props(s.label)}>{label}</span>
        <span {...stylex.props(s.value)}>
          {format(value)}
          {unit ? <span {...stylex.props(s.unit)}>{unit}</span> : null}
        </span>
      </div>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
        {...stylex.props(s.input)}
      />
    </div>
  );
}
