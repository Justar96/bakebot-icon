import * as stylex from "@stylexjs/stylex";
import { useMemo, type ReactNode, type SVGProps } from "react";

import { color, type } from "./tokens.stylex";

/**
 * The drawing language the spec cards are annotated in.
 *
 * A dimension line, a dashed guide, a corner handle, a leader and a label —
 * the marks a technical drawing uses, and nothing else. They carry no mascot
 * and no clock: a card composes them around whatever it is measuring, and the
 * live values are written into them by `live-frame.tsx`.
 *
 * Everything is drawn in one flat coordinate space, quoted in card pixels so a
 * 9-unit label is a 9px label at the card's nominal width. What is being
 * measured usually lives in the mascot's 64-unit viewBox, so `project` maps
 * between the two and the geometry a card quotes is the geometry the package
 * gave it, scaled — never a second set of numbers typed out to match.
 *
 * Strokes inside a scaled group carry `vector-effect: non-scaling-stroke`, so a
 * hairline stays a hairline whatever the drawing is magnified by.
 */

const HANDLE = 3.4;
const TICK = 3;

/* The paper: an 8px square, heavier every fifth line, the way engineering
 * paper is ruled. Both numbers are in card pixels like everything else here,
 * so the grid is fixed to the drawing rather than to the screen — a card
 * rendered wider keeps the geometry sitting on the same squares. */
const PAPER = 8;
const PAPER_MAJOR = 5;

export const bp = stylex.create({
  stage: { display: "block", width: "100%", height: "auto", overflow: "visible" },
  /* The thing being measured. */
  outline: { fill: "none", stroke: color.lineStrong, strokeWidth: 1 },
  /* A region rather than an object: where something may go, not where it is. */
  guide: { fill: "none", stroke: color.line, strokeWidth: 1, strokeDasharray: "3 3" },
  /* The measurements themselves, quieter than either. */
  dim: { fill: "none", stroke: color.faint, strokeWidth: 1, opacity: 0.75 },
  /* The ruling under everything.
   *
   * Both weights sit below `guide`, which is the faintest mark a card makes
   * on purpose — paper that reaches a real line's weight stops being paper
   * and starts being a measurement. `line` is already the lightest colour
   * the page owns (1.35:1 on a card); these take it down to roughly 1.25:1
   * and 1.14:1, which is a texture you see when you look for it and read
   * past when you are reading the drawing. */
  paperMajor: { fill: "none", stroke: color.line, strokeWidth: 1, opacity: 0.7 },
  paper: { fill: "none", stroke: color.line, strokeWidth: 1, opacity: 0.4 },
  handle: { fill: color.bg, stroke: color.accent, strokeWidth: 1 },
  /* `dim`: these annotate the drawing at 9px, which is the smallest type on
   * the page and the least able to carry `faint`'s 2.73:1. */
  label: {
    fill: color.dim,
    stroke: "none",
    fontFamily: type.mono,
    fontSize: 9,
    letterSpacing: "normal",
  },
  /* A label whose number is arriving from the clock rather than from the spec. */
  reading: { fill: color.ink, fontWeight: 500 },
  accent: { fill: color.accent, stroke: "none" },
  hair: { vectorEffect: "non-scaling-stroke" },
});

/**
 * The grid, as two paths rather than a `<pattern>`.
 *
 * A pattern would need an id, and an id inside a component rendered five
 * times is five copies of the same name in one document. The lines are cheap
 * to write out and this way the paper is plain geometry like the rest of the
 * drawing.
 */
function rule(width: number, height: number) {
  let fine = "";
  let major = "";
  for (let i = 1, x = PAPER; x < width; i += 1, x += PAPER) {
    const line = `M${x} 0V${height}`;
    if (i % PAPER_MAJOR === 0) major += line;
    else fine += line;
  }
  for (let i = 1, y = PAPER; y < height; i += 1, y += PAPER) {
    const line = `M0 ${y}H${width}`;
    if (i % PAPER_MAJOR === 0) major += line;
    else fine += line;
  }
  return { fine, major };
}

/** The card's drawing surface. One flat space, `width` × `height` card pixels. */
export function Stage({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  /* The card is on a page whose readings move every frame; the ruling under
   * them never does, so it is built once per size rather than per render. */
  const grid = useMemo(() => rule(width, height), [width, height]);
  return (
    <svg
      {...stylex.props(bp.stage)}
      aria-hidden="true"
      role="presentation"
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Bounded by the viewBox even though the stage overflows, so the
        * paper has an edge and the annotations that spill past it do not
        * drag the sheet with them. */}
      <path {...stylex.props(bp.paper, bp.hair)} d={grid.fine} />
      <path {...stylex.props(bp.paperMajor, bp.hair)} d={grid.major} />
      {children}
    </svg>
  );
}

/**
 * A window onto the mascot's 64-unit viewBox, and the map into it.
 *
 * `at` converts view units to card pixels so an annotation can sit against
 * something drawn inside the window, and `scale` converts a length.
 */
export interface Projection {
  x(unit: number): number;
  y(unit: number): number;
  scale(length: number): number;
  /** The window's bounds in card pixels, for a dimension line along an edge. */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function project(originX: number, originY: number, scale: number, view = 64): Projection {
  return {
    x: (unit) => originX + unit * scale,
    y: (unit) => originY + unit * scale,
    scale: (length) => length * scale,
    left: originX,
    top: originY,
    right: originX + view * scale,
    bottom: originY + view * scale,
  };
}

/** The group everything drawn in view units goes inside. */
export function Window({
  at,
  children,
}: {
  at: Projection;
  children: ReactNode;
}) {
  const scale = at.scale(1);
  return <g transform={`translate(${at.left} ${at.top}) scale(${scale})`}>{children}</g>;
}

/** A horizontal measurement, ticked at both ends. */
export function DimH({
  from,
  to,
  y,
  label,
  below = false,
}: {
  from: number;
  to: number;
  y: number;
  label?: ReactNode;
  below?: boolean;
}) {
  return (
    <g {...stylex.props(bp.dim)}>
      <line x1={from} x2={to} y1={y} y2={y} />
      <line x1={from} x2={from} y1={y - TICK} y2={y + TICK} />
      <line x1={to} x2={to} y1={y - TICK} y2={y + TICK} />
      {label === undefined ? null : (
        <text
          {...stylex.props(bp.label)}
          textAnchor="middle"
          x={(from + to) / 2}
          y={below ? y + 11 : y - 5}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** A vertical measurement. Its label stays upright, to the left of the line. */
export function DimV({
  from,
  to,
  x,
  label,
  right = false,
}: {
  from: number;
  to: number;
  x: number;
  label?: ReactNode;
  right?: boolean;
}) {
  return (
    <g {...stylex.props(bp.dim)}>
      <line x1={x} x2={x} y1={from} y2={to} />
      <line x1={x - TICK} x2={x + TICK} y1={from} y2={from} />
      <line x1={x - TICK} x2={x + TICK} y1={to} y2={to} />
      {label === undefined ? null : (
        <text
          {...stylex.props(bp.label)}
          textAnchor={right ? "start" : "end"}
          x={right ? x + 6 : x - 6}
          y={(from + to) / 2 + 3}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** Selection handles on a bounding box: what is being looked at. */
export function Handles({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const corners: readonly [number, number][] = [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
    [x + width / 2, y],
    [x + width / 2, y + height],
    [x, y + height / 2],
    [x + width, y + height / 2],
  ];
  return (
    <g {...stylex.props(bp.handle)}>
      {corners.map(([cx, cy]) => (
        <rect
          height={HANDLE}
          key={`${cx},${cy}`}
          width={HANDLE}
          x={cx - HANDLE / 2}
          y={cy - HANDLE / 2}
        />
      ))}
    </g>
  );
}

/** A leader from a label to the thing it names. */
export function Leader({
  from,
  to,
}: {
  from: readonly [number, number];
  to: readonly [number, number];
}) {
  return (
    <g {...stylex.props(bp.dim)}>
      <line x1={from[0]} x2={to[0]} y1={from[1]} y2={to[1]} />
      <circle cx={to[0]} cy={to[1]} r={1.4} {...stylex.props(bp.accent)} />
    </g>
  );
}

/** A bare label, in the drawing rather than in the readout under it. */
export function Note({
  x,
  y,
  anchor = "start",
  reading = false,
  children,
  ...rest
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  /** Set for a number the clock is writing, so it reads as a value not a name. */
  reading?: boolean;
  children?: ReactNode;
} & SVGProps<SVGTextElement>) {
  return (
    <text
      {...stylex.props(bp.label, reading && bp.reading)}
      textAnchor={anchor}
      x={x}
      y={y}
      {...rest}
    >
      {children}
    </text>
  );
}
