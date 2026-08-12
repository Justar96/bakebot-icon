/**
 * The shape the eye lives inside, and what happens when it reaches the edge.
 *
 * All of it is a signed distance field: one function answers how far a point
 * is from the tile's border, a second answers which way the border faces, and
 * the collision response is those two applied to a velocity. Nothing here
 * knows about eyes, lids or glances.
 */

/* Geometry, in viewBox units measured from the icon centre (32, 32).
 *
 * The tile is a 60-unit square with rx=16, so its half extent is 30. The eye
 * collides with that border itself: its travel region is the tile inset by the
 * eye's own radius, which for a rounded rectangle is another rounded rectangle
 * with both the half extent and the corner radius reduced by the same amount.
 * The eye's rim therefore rides the border line exactly — along the straights
 * and around the corner arcs — rather than against an invisible box inside it. */
export const TILE = { half: 30, radius: 16, eye: 14, pupil: 6 } as const;
export const TRAVEL_HALF = TILE.half - TILE.eye;
export const TRAVEL_RADIUS = TILE.radius - TILE.eye;

/* Collision. Friction is a rate rather than a per-step factor, so the response
 * does not change with the step size. Low restitution and low friction is what
 * makes the eye slide along a wall into a corner instead of bouncing off it. */
const RESTITUTION = 0.18;
const FRICTION_RATE = 3.5;

export const clamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

export const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Signed distance to a rounded rectangle centred on the origin. */
export function roundedRectDistance(x: number, y: number, half: number, radius: number): number {
  const qx = Math.abs(x) - half + radius;
  const qy = Math.abs(y) - half + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

/**
 * Outward unit normal of that boundary. On a flat wall it is axis aligned; on
 * a corner arc it is the diagonal, which is what turns a corner press into a
 * splat across both walls rather than a flatten against one.
 */
export function boundaryNormal(
  x: number,
  y: number,
  half: number,
  radius: number,
): [number, number] {
  const qx = Math.abs(x) - half + radius;
  const qy = Math.abs(y) - half + radius;
  const nx = Math.sign(x) * Math.max(qx, 0);
  const ny = Math.sign(y) * Math.max(qy, 0);
  const length = Math.hypot(nx, ny);
  if (length > 1e-6) return [nx / length, ny / length];
  // Inside the core rectangle, where the nearest wall is the closest axis.
  return qx > qy ? [Math.sign(x) || 1, 0] : [0, Math.sign(y) || 1];
}

/** How far outside its travel region a point is; negative is inside. */
export const travelDistance = (x: number, y: number): number =>
  roundedRectDistance(x, y, TRAVEL_HALF, TRAVEL_RADIUS);

/** Which way the travel boundary faces at a point. */
export const travelNormal = (x: number, y: number): [number, number] =>
  boundaryNormal(x, y, TRAVEL_HALF, TRAVEL_RADIUS);

export interface BoundaryContact {
  x: number;
  y: number;
  vx: number;
  vy: number;
  nx: number;
  ny: number;
  /** Closing speed along the normal at the moment of contact. */
  impact: number;
}

/**
 * Project a point back onto the travel boundary and answer with the velocity
 * it keeps. The normal component comes back scaled by restitution while the
 * tangential component only loses friction, so a glance aimed past a corner
 * reaches the wall and then slides the rest of the way in.
 */
export function resolveBoundary(
  x: number,
  y: number,
  vx: number,
  vy: number,
  seconds: number,
): BoundaryContact {
  const distance = travelDistance(x, y);
  if (distance <= 0) return { x, y, vx, vy, nx: 0, ny: 0, impact: 0 };

  const [nx, ny] = travelNormal(x, y);
  const impact = Math.max(vx * nx + vy * ny, 0);
  const bounce = impact * (1 + RESTITUTION);
  const keptX = vx - nx * bounce;
  const keptY = vy - ny * bounce;

  const normalPart = keptX * nx + keptY * ny;
  const keep = Math.exp(-FRICTION_RATE * seconds);
  const tangentX = (keptX - nx * normalPart) * keep;
  const tangentY = (keptY - ny * normalPart) * keep;

  return {
    x: x - nx * distance,
    y: y - ny * distance,
    vx: nx * normalPart + tangentX,
    vy: ny * normalPart + tangentY,
    nx,
    ny,
    impact,
  };
}
