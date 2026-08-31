/**
 * The shape the eye lives inside, what happens when it reaches the edge, and
 * which way that means the face is turned.
 *
 * The first two are a signed distance field: one function answers how far a
 * point is from the tile's border, a second answers which way the border
 * faces, and containment is those two applied to a position and a velocity.
 * The third is a sphere. Nothing here knows about lids or glances.
 */

export const clamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

export const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/* Proportions, in viewBox units measured from the icon centre (32, 32).
 *
 * `half` is the largest a tile may be, `eye` the radius the pair of eyes fits
 * inside, and `disc` the radius of one of them. All fixed: what a caller
 * chooses is the tile's shape, not how much room the icon takes or how big the
 * character is in it.
 *
 * `overshoot` is how far past the tile's border the eye's rim may go. An eye
 * that stopped with its rim exactly on the border reads as a ball resting
 * against the inside of a box — the whole of it always visible, always
 * complete. A real eye at the far end of its travel goes round the side of the
 * head and part of it stops being visible. So the eye is allowed past the
 * border and the tile clips it, which is what makes the far look read as a
 * face turning rather than as a shape sliding to a stop.
 *
 * It is measured against `eye`, the pair's bounding radius seen face-on — but
 * the pair only ever reaches the border at a full turn, and by then the
 * leading disc has narrowed and the pair sits some four units inside that
 * bound. So the first four units of overshoot cost a reader nothing, and
 * everything past them comes out of the one eye with the least width left to
 * give. At six it took a third of that eye's width and left a bar rather than
 * an eye. What remains here is the bite a reader should actually see. */
export const TILE = { half: 30, eye: 14, disc: 6, overshoot: 4.5 } as const;

/* What the travel region is inset by: the eye's radius, less what it is
 * allowed to hang over the border. */
const TRAVEL_INSET = TILE.eye - TILE.overshoot;

/* Where the two eyes sit on the head, as an angle from straight ahead. Turning
 * carries each eye along its own arc: the pair's spacing closes, both slide
 * toward the turn, and the leading one narrows as it approaches the silhouette.
 * That last cue is what makes a flat face read as *turned* rather than as slid
 * sideways, and none of it is keyframed — it falls out of the circle. */
const EYE_AZIMUTH = (60 * Math.PI) / 180;

/* The closest the visible rims of the two discs may come. Four view units are
 * two CSS pixels at the default 32px size: enough for the face to keep reading
 * as a pair when it is straight ahead, without making a turned face look
 * startled. It is resolved in the pair's own 2D plane below, not on X alone:
 * a pitched pair meets along a diagonal or vertical separation axis. */
const EYE_MIN_GAP = 4;

/* The narrowest a turned disc is drawn, as a fraction of its face-on width.
 * A full yaw carries the leading eye to the sphere's silhouette, where a
 * literal projection has no width at all and the face loses an eye outright.
 * A face reads as turned from the narrowing, not from the disappearance, so
 * the projection is mapped onto `[this, 1]` instead of `[0, 1]`.
 *
 * It sits above half because the tile takes a second bite out of the same eye:
 * the turn that narrows it is the turn that carries it past the border. What a
 * reader is owed is half an eye left *after* that clip, not half an eye drawn
 * and a quarter of one shown. The surplus over half is what `TILE.overshoot`
 * is allowed to cut into. */
const EYE_MIN_SCALE_X = 0.65;

/* How much of the eye's height a full blink takes away. Short of 1 so a shut
 * eye is still a line rather than nothing at all. */
const LID_CLOSE = 0.92;

/**
 * A tile to live in: a rounded rectangle, given as half extents and a corner
 * radius. Every field is optional and defaults to the circle.
 *
 * One family rather than a set of drawings, because the family is what the
 * distance field can answer about. A square, a squircle, a circle and a
 * capsule are all values of these three numbers, so the simulation never asks
 * which shape it is in — it asks the same two questions of any of them.
 */
export interface TileSpec {
  /** Half the tile's width, clamped to `[TILE.eye, TILE.half]`. */
  halfX?: number;
  /** Half the tile's height, clamped to `[TILE.eye, TILE.half]`. */
  halfY?: number;
  /** Corner radius, clamped to the smaller half — where it rounds that axis fully. */
  radius?: number;
}

/**
 * The shapes the mascot ships with.
 *
 * Named so the common choices are one word, not so the mascot has six modes:
 * each is an ordinary `TileSpec`, a caller may pass their own, and nothing
 * downstream can tell the difference.
 */
export const MASCOT_SHAPES = {
  /** Hard corners. The eye reaches furthest on the diagonal. */
  square: { radius: 0 },
  /** The app-icon rounding. Still corners, because the eyes cannot fit in them. */
  rounded: { radius: 8 },
  /** Rounded far enough that the corners are arcs the eyes can enter. */
  squircle: { radius: 18 },
  /** No corner anywhere on it. The default. */
  circle: { radius: TILE.half },
  /** A wide capsule: flat above and below, a semicircle at each end. */
  pill: { halfY: 20, radius: 20 },
  /** A landscape tile with a modest rounding — a chip rather than an icon. */
  card: { halfY: 22, radius: 8 },
} as const satisfies Record<string, TileSpec>;

export type MascotShapeName = keyof typeof MASCOT_SHAPES;

/**
 * A resolved tile shape: the border, and the region the eye's centre may
 * occupy.
 *
 * The travel region is derived rather than given, which is the point: it is
 * the tile inset by `TRAVEL_INSET` — for a rounded rectangle, another rounded
 * rectangle with both half extents and the corner radius reduced by the same
 * amount. So wherever the eye is on that boundary its rim hangs exactly
 * `TILE.overshoot` past the tile's own border, in every shape, without
 * anything special-casing one. What the reader sees of it there is the tile's
 * business: a renderer clips the eye to the tile it drew.
 */
export interface TileShape {
  readonly halfX: number;
  readonly halfY: number;
  readonly radius: number;
  /** The travel region: the tile inset by `TILE.eye - TILE.overshoot`. */
  readonly travelHalfX: number;
  readonly travelHalfY: number;
  readonly travelRadius: number;
}

const extent = (value: number | undefined) =>
  clamp(Number.isFinite(value) ? (value as number) : TILE.half, TILE.eye, TILE.half);

/**
 * Resolve a shape name or spec into what the simulation reads.
 *
 * A radius at the smaller half rounds that axis completely, and that is not a
 * special case below: a rounded rectangle with `radius === halfX === halfY`
 * *is* a circle, and one with `radius === halfY < halfX` *is* a capsule. Both
 * the distance function and the normal degenerate to the exact ones. The shape
 * is a dial rather than a branch — nothing downstream asks which shape it has,
 * only what this says about the one it was given.
 */
export function tileShape(shape?: MascotShapeName | TileSpec | null): TileShape {
  const spec: TileSpec =
    typeof shape === "string" ? (MASCOT_SHAPES[shape] ?? MASCOT_SHAPES.circle) : (shape ?? {});
  const halfX = extent(spec.halfX);
  const halfY = extent(spec.halfY);
  const radius = clamp(
    Number.isFinite(spec.radius) ? (spec.radius as number) : TILE.half,
    0,
    Math.min(halfX, halfY),
  );
  const travelHalfX = halfX - TRAVEL_INSET;
  const travelHalfY = halfY - TRAVEL_INSET;
  // A corner tighter than the inset is one the eye's centre cannot round, so
  // its region has a hard corner there however round the tile itself is.
  const travelRadius = clamp(radius - TRAVEL_INSET, 0, Math.min(travelHalfX, travelHalfY));
  return { halfX, halfY, radius, travelHalfX, travelHalfY, travelRadius };
}

/** The shape the mascot has unless a caller says otherwise: a circle. */
export const DEFAULT_SHAPE = tileShape();

/* The square everything above is measured in. Private because the simulation
 * only ever works from the centre; a renderer needs it, and gets it through
 * `mascotGeometry`. */
const VIEW = 64;

/** Everything a renderer needs to draw the mascot, in view units. */
export interface MascotGeometry {
  /** The square the whole mascot is drawn in. */
  view: number;
  /** The icon centre. Every transform pivots here, and poses are offsets from it. */
  centre: number;
  /** The tile, as a rect. These four are what make it one shape or another. */
  tile: { x: number; y: number; width: number; height: number; radius: number };
  /**
   * The two eyes: discs of `radius` on a sphere of this `reach`. Face-on their
   * raw projection is `±reach·sin(azimuth)`; `facingEyes` may open that spacing
   * slightly to preserve its contact seam, then moves them along their own arcs.
   * `reach` remains the furthest either centre can go.
   */
  eyes: {
    reach: number;
    radius: number;
    azimuth: number;
    /** Smallest visible rim-to-rim distance between the projected discs. */
    minimumGap: number;
    /**
     * The narrowest principal-axis scale a turned disc is given, as a fraction
     * of its face-on width. The leading eye reaches the silhouette at a full
     * yaw; this is what leaves an eye there instead of projecting it away, and
     * it carries the width the tile's clip then takes its bite out of.
     */
    minimumScaleX: number;
  };
  /**
   * How a shut lid is drawn: the eye flattens by `close` about its own centre,
   * and `drop` is what puts its lower rim back where the open eye's was.
   */
  lid: { close: number; drop: number };
}

/**
 * What to draw for a given shape.
 *
 * The simulation works from the icon centre and never needs any of this, but a
 * renderer does — and a renderer that had to re-type it would be drawing a
 * second mascot that merely resembled the first. Every field is derived from
 * the same `tileShape` the eye collides against, so the shape a renderer draws
 * and the shape the eye is confined to cannot drift apart in any of them.
 *
 * `lid` is here rather than in a renderer because `pose.lid` is a bare scalar:
 * it says how shut, and this says what shut looks like. Two renderers choosing
 * their own closure would blink differently, which makes it the character's
 * decision and not the drawing's.
 */
export function mascotGeometry(shape?: MascotShapeName | TileSpec | null): MascotGeometry {
  const tile = tileShape(shape);
  return {
    view: VIEW,
    centre: VIEW / 2,
    tile: {
      x: VIEW / 2 - tile.halfX,
      y: VIEW / 2 - tile.halfY,
      width: tile.halfX * 2,
      height: tile.halfY * 2,
      radius: tile.radius,
    },
    /* Derived rather than chosen, so a turning face cannot swing an eye
     * somewhere the simulation did not account for: the furthest either can
     * reach is `TILE.eye - TILE.disc`, and with its own `TILE.disc` radius on
     * top that is exactly `TILE.eye` — what the travel region is measured
     * from. So the pair's bounding circle is the same at any turn, and the
     * tile clips it the same way. */
    eyes: {
      reach: TILE.eye - TILE.disc,
      radius: TILE.disc,
      azimuth: EYE_AZIMUTH,
      minimumGap: EYE_MIN_GAP,
      minimumScaleX: EYE_MIN_SCALE_X,
    },
    /* A blink is a lid coming down over an eye that has not moved, so the
     * lower rim must stay put. Flattening a disc about its own centre lifts
     * that rim by `radius · close`, and `drop` is exactly that much back down
     * — derived rather than chosen, because a constant here drifts from the
     * radius and the eye starts lifting off its own baseline as it shuts. */
    lid: { close: LID_CLOSE, drop: TILE.disc * LID_CLOSE },
  };
}

/** What to draw for the default shape. */
export const MASCOT_GEOMETRY = mascotGeometry();

/** Signed distance to a rounded rectangle centred on the origin. */
export function roundedRectDistance(
  x: number,
  y: number,
  halfX: number,
  halfY: number,
  radius: number,
): number {
  // A corner radius past either half extent is degenerate; clamp it so the
  // field stays a rounded rectangle rather than turning inside out.
  const r = clamp(radius, 0, Math.min(halfX, halfY));
  const qx = Math.abs(x) - halfX + r;
  const qy = Math.abs(y) - halfY + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

/**
 * Outward unit normal of that boundary: the direction a point outside it has
 * to come back along, and so the direction it can no longer travel in.
 */
export function boundaryNormal(
  x: number,
  y: number,
  halfX: number,
  halfY: number,
  radius: number,
): [number, number] {
  const r = clamp(radius, 0, Math.min(halfX, halfY));
  const qx = Math.abs(x) - halfX + r;
  const qy = Math.abs(y) - halfY + r;
  const nx = Math.sign(x) * Math.max(qx, 0);
  const ny = Math.sign(y) * Math.max(qy, 0);
  const length = Math.hypot(nx, ny);
  if (length > 1e-6) return [nx / length, ny / length];
  // Inside the core rectangle, where the nearest wall is the closest axis.
  if (qx > qy) return [Math.sign(x) || 1, 0];
  if (qy > qx) return [0, Math.sign(y) || 1];
  // Equidistant from two walls, so neither of them is the answer. With no
  // corner radius that point is the vertex itself, and a vertex faces the
  // diagonal — without this a hard square reports a flat wall exactly where its
  // corner is, and projects the eye sideways out of it.
  return [(Math.sign(x) || 1) * Math.SQRT1_2, (Math.sign(y) || 1) * Math.SQRT1_2];
}

/** How far outside its travel region a point is; negative is inside. */
export const travelDistance = (x: number, y: number, shape: TileShape = DEFAULT_SHAPE): number =>
  roundedRectDistance(x, y, shape.travelHalfX, shape.travelHalfY, shape.travelRadius);

/** Which way the travel boundary faces at a point. */
export const travelNormal = (
  x: number,
  y: number,
  shape: TileShape = DEFAULT_SHAPE,
): [number, number] =>
  boundaryNormal(x, y, shape.travelHalfX, shape.travelHalfY, shape.travelRadius);

export interface Contained {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Hold a point inside its travel region.
 *
 * This is containment, not collision. Nothing rebounds, nothing is scrubbed off
 * by friction, and no impulse is reported: the point is put back on the
 * boundary and only the part of its velocity that was leaving is taken away, so
 * the eye slides along the border rather than stopping dead against it or
 * bouncing off it.
 *
 * What a reader sees at the border is not an impact. It is the face turned that
 * way — the eye's distance from the centre is what `MascotPose.yaw` and `pitch`
 * are read from, so arriving at the border *is* looking in that direction.
 */
export function contain(
  x: number,
  y: number,
  vx: number,
  vy: number,
  shape: TileShape = DEFAULT_SHAPE,
): Contained {
  const distance = travelDistance(x, y, shape);
  if (distance <= 0) return { x, y, vx, vy };

  const [nx, ny] = travelNormal(x, y, shape);
  const leaving = Math.max(vx * nx + vy * ny, 0);
  return {
    x: x - nx * distance,
    y: y - ny * distance,
    vx: vx - nx * leaving,
    vy: vy - ny * leaving,
  };
}

/* How far the face has turned once the eye has reached the border. Yaw carries
 * the read, so it is the larger of the two: a face that pitched as far as it
 * yaws would look like it was nodding rather than looking. */
/* A full horizontal look is the one that carries the leading disc all the way
 * to the sphere's silhouette, which is what makes it the furthest the face
 * turns rather than an angle picked to look right. What the disc is drawn as
 * when it gets there is `EYE_MIN_SCALE_X`, not nothing. Pitch is deliberately
 * gentler than yaw, but strong enough to produce a readable tilt rather than
 * only a sub-pixel change. */
const YAW_MAX = ((Math.PI / 2 - EYE_AZIMUTH) * 180) / Math.PI;
const PITCH_MAX = YAW_MAX * 0.6;

/**
 * The turn a face is holding, in degrees, given where its eye has travelled.
 *
 * This is the whole replacement for collision. The eye's distance from the
 * centre is not a measure of how hard it is pressing on something — it is how
 * far the face has turned, full turn at the border. So "the eye is near the
 * edge" and "the face is looking that way" stop being two facts that have to
 * be kept in agreement and become one.
 *
 * Both are signed the way the pose is: yaw positive to the right like `x`,
 * pitch positive downward like `y`.
 */
export function facingAngles(
  x: number,
  y: number,
  shape: TileShape = DEFAULT_SHAPE,
): [number, number] {
  return [
    shape.travelHalfX > 0 ? YAW_MAX * clamp(x / shape.travelHalfX, -1, 1) : 0,
    shape.travelHalfY > 0 ? PITCH_MAX * clamp(y / shape.travelHalfY, -1, 1) : 0,
  ];
}

/** One eye of a turned face: where to draw it, and how foreshortened it is. */
export interface FacingEye {
  x: number;
  y: number;
  /**
   * Foreshortening along the axis the disc narrows on, which `rotation`
   * orients. It never falls below `eyes.minimumScaleX`, so a fully turned face
   * still has two eyes.
   */
  scaleX: number;
  /**
   * The axis across that one, which a circle seen at an angle never shortens.
   * It stays at one; it is kept as a field so a renderer writes one scale for
   * both axes rather than special-casing which of them foreshortens.
   */
  scaleY: number;
  /**
   * Which way the narrowing runs, in degrees, in the 2D render plane. Zero
   * whenever there is no visible narrowing to orient — a disc drawn round, or
   * one seen dead-on — so a renderer is never handed an arbitrary angle to
   * turn a lid around.
   */
  rotation: number;
}

/**
 * Where the two eyes go for a given turn, in view units from the face centre.
 * Left first.
 *
 * Both are points on a sphere of radius `eyes.reach`, at `±eyes.azimuth` from
 * front. Yaw swings them around it and pitch tips them, then their shared
 * midpoint is removed: `MascotPose.x/y` owns where the pair is, while this
 * function owns only spacing, tilt and foreshortening inside the pair. Without
 * that recentering a turn would translate the face twice — once through the
 * simulation and again through its spherical projection.
 *
 * The projection is also its own non-penetration constraint. If an extreme
 * turn would overlap the two projected ellipses, they are moved equally apart
 * along their 2D centre-to-centre axis. Pitch can make that axis diagonal or
 * vertical, so resolving only X would cause the pair to skate sideways instead
 * of reacting where it met. There is no bounce: contact is a geometric limit,
 * like the tile boundary, not a second simulation.
 *
 * Each disc is a round patch tangent to that sphere. Yaw and pitch rotate its
 * surface normal; that normal's 2D shadow gives the axis the projected circle
 * narrows on, while its Z component gives how narrow. This is still entirely
 * 2D: a renderer receives one translation, rotation and scale per disc, with
 * no camera, Z coordinate or depth ordering. At rest both factors are one and
 * the pair is round and evenly spaced.
 *
 * It lives here rather than in a renderer because it is what the character
 * *is*. Two renderers deriving their own spacing would turn differently.
 */
export function facingEyes(
  yaw: number,
  pitch: number,
  geometry: MascotGeometry = MASCOT_GEOMETRY,
): [FacingEye, FacingEye] {
  const { reach, azimuth } = geometry.eyes;
  const yawed = (yaw * Math.PI) / 180;
  const pitched = (pitch * Math.PI) / 180;
  const sinPitch = Math.sin(pitched);
  const cosPitch = Math.cos(pitched);
  const front = Math.cos(azimuth);
  const floor = geometry.eyes.minimumScaleX;
  const eye = (side: -1 | 1): FacingEye => {
    const angle = side * azimuth + yawed;
    const depth = Math.cos(angle);

    /* The disc lies flat on the sphere at `normal`, so its projection is an
     * ellipse in closed form: the axis along the normal's own shadow is
     * squeezed by how much of the normal points at the reader, and the axis
     * across it is not squeezed at all. No covariance, no eigenvectors — a
     * circle seen at an angle only ever narrows one way.
     *
     * `normalZ` carries the pitch as well as the turn, which is what makes the
     * diagonals behave: a face that is both turned and tipped foreshortens by
     * the product, and the axis it narrows along tips with it.
     *
     * Dividing by `front` is the one liberty taken with the sphere: it makes
     * the resting eye round, where a literal projection would draw it already
     * flattened by its own azimuth. Values past one are capped, because an eye
     * coming back round the face should not swell larger than face-on. */
    const normalX = Math.sin(angle);
    const normalY = depth * sinPitch;
    const normalZ = depth * cosPitch;
    const narrow = clamp(normalZ / front, 0, 1);

    /* Where that shadow points, and so which way the eye narrows. It is an
     * axis rather than a direction — half a turn is the same ellipse — so it
     * is folded into a quarter turn either side of upright. A disc whose
     * shadow has no length is being seen dead-on and has no axis to speak of;
     * a disc drawn round has one that no reader could see. Both report zero,
     * so neither hands the renderer a rotation to spin the lid around. */
    const shadow = Math.hypot(normalX, normalY);
    let rotation = 0;
    if (shadow > 1e-9 && narrow < 1 - 1e-9) {
      rotation = Math.atan2(normalY, normalX);
      while (rotation > Math.PI / 2) rotation -= Math.PI;
      while (rotation <= -Math.PI / 2) rotation += Math.PI;
    }

    return {
      x: reach * normalX,
      y: reach * normalY,
      scaleX: floor + (1 - floor) * narrow,
      scaleY: 1,
      rotation: (rotation * 180) / Math.PI,
    };
  };
  const left = eye(-1);
  const right = eye(1);
  const middleX = (left.x + right.x) / 2;
  const middleY = (left.y + right.y) / 2;
  left.x -= middleX;
  left.y -= middleY;
  right.x -= middleX;
  right.y -= middleY;
  separateEyes(left, right, geometry.eyes.radius, geometry.eyes.minimumGap);
  return [left, right];
}

/** Keep the projected ellipses from crossing, preserving their shared centre. */
function separateEyes(left: FacingEye, right: FacingEye, radius: number, minimumGap: number): void {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const distance = Math.hypot(dx, dy);
  // Exactly edge-on and level can project both centres onto one point. With no
  // separation axis left to read, horizontal is the continuous limit as pitch
  // approaches zero from the ordinary face-on pose.
  const axisX = distance > 1e-6 ? dx / distance : 1;
  const axisY = distance > 1e-6 ? dy / distance : 0;
  const support = (eye: FacingEye) => {
    const rotation = (eye.rotation * Math.PI) / 180;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    // Resolve the screen-space separation axis into the ellipse's own rotated
    // axes before measuring its extent along that line.
    const localX = axisX * cosine + axisY * sine;
    const localY = -axisX * sine + axisY * cosine;
    return Math.hypot(radius * eye.scaleX * localX, radius * eye.scaleY * localY);
  };
  const overlap = support(left) + support(right) + minimumGap - distance;
  if (overlap <= 0) return;

  const correction = overlap / 2;
  left.x -= axisX * correction;
  left.y -= axisY * correction;
  right.x += axisX * correction;
  right.y += axisY * correction;
}
