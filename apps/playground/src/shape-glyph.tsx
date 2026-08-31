import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { MASCOT_SHAPES, type MascotShapeName, type TileSpec } from "@bakebot/react";

import { control } from "./tokens.stylex";

/**
 * A tile shape, drawn from the numbers the character describes it with.
 *
 * The mascot's shapes are `TileSpec`s — two half extents and a corner radius,
 * on a scale where the tile's own half is 30. That is already everything an
 * icon of one needs, so this reads the package's own table rather than keeping
 * a second list of six pictures here: a shape added to the character shows up
 * in the dropdown without this file being told about it.
 *
 * The viewBox is the character's coordinate space, which is what makes the
 * glyph a scale drawing rather than a resemblance — `pill` is as flat here as
 * it is on the stage, because it is the same 20 out of 30 in both.
 */

const HALF = 30;

const s = stylex.create({
  glyph: { display: "block", flex: "none", width: control.icon, height: control.icon },
  tile: (fill: string) => ({ fill }),
});

export function ShapeGlyph({
  shape,
  color = "currentColor",
  style,
}: {
  shape: MascotShapeName;
  color?: string;
  /** For the one place it is not an icon: the card's own 28px media tile. */
  style?: StyleXStyles;
}) {
  /* Read as the interface rather than as the literal: the table is `as const`,
   * so a member that leaves a half extent at its default has no key for it. */
  const { halfX = HALF, halfY = HALF, radius = 0 }: TileSpec = MASCOT_SHAPES[shape];

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${HALF * 2} ${HALF * 2}`}
      {...stylex.props(s.glyph, style)}
    >
      <rect
        height={halfY * 2}
        rx={radius}
        width={halfX * 2}
        x={HALF - halfX}
        y={HALF - halfY}
        {...stylex.props(s.tile(color))}
      />
    </svg>
  );
}
