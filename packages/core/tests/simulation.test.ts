import { describe, expect, it } from "bun:test";

/**
 * The properties the mascot's motion must keep.
 *
 * One file for four modules, because what matters crosses them: containment is
 * the eye against the geometry, a corner splat is the geometry against the
 * deformation spring, and where the eye rests is the gaze weighting against
 * both. Each test states the behaviour it protects; several exist because the
 * behaviour was once wrong in exactly that way.
 */

import {
  advanceEye,
  BLINK_CYCLE,
  blinkClosure,
  createEyeState,
  deformation,
  isBlinking,
  MAX_STRETCH,
  type EyeState,
} from "../src/eye.js";
import {
  ATTENTIVE_GAZE_INTENTS,
  createRandom,
  DEFAULT_GAZE_INTENTS,
  intentWeight,
  nextIntentIndex,
  normalizeGazeIntents,
} from "../src/gaze.js";
import {
  boundaryNormal,
  contain,
  DEFAULT_SHAPE,
  facingAngles,
  facingEyes,
  type FacingEye,
  MASCOT_GEOMETRY,
  MASCOT_SHAPES,
  roundedRectDistance,
  TILE,
  tileShape,
  travelDistance,
  type TileShape,
} from "../src/geometry.js";
import { stepSpring } from "../src/spring.js";
import { STATE_GAZE } from "../src/states.js";
import { resolveTuning } from "../src/tuning.js";
import type { GazeIntent } from "../src/protocol.js";

const STEP = 1 / 240;
const CORNER = { x: 26, y: -26 };
const WALL = { x: -32, y: 0 };
/** Inside the deadzone, so it is a look the eyes do not move for at all. */
const INSIDE = { x: 0, y: -3 };
/** Past the deadzone but well short of the border: an ordinary glance. */
const GLANCE = { x: 11, y: -6 };

/** How far outside its travel region the eye centre is; negative is inside. */
const escapeOf = (state: EyeState, shape: TileShape = DEFAULT_SHAPE) =>
  travelDistance(state.x.position, state.y.position, shape);

const stretchOf = (state: EyeState) =>
  deformation(state.jellyX.position, state.jellyY.position).stretch - 1;

function drive(
  state: EyeState,
  intent: { x: number; y: number },
  seconds: number,
  from = 0,
  shape: TileShape = DEFAULT_SHAPE,
) {
  let clock = from;
  let escaped = -Infinity;
  for (let step = 0; step < Math.round(seconds / STEP); step += 1) {
    clock += STEP;
    advanceEye(state, intent, STEP, clock, undefined, shape);
    escaped = Math.max(escaped, escapeOf(state, shape));
  }
  return { clock, escaped };
}

function run(
  intent: { x: number; y: number },
  seconds: number,
  shape: TileShape = DEFAULT_SHAPE,
) {
  const state = createEyeState();
  const { escaped } = drive(state, intent, seconds, 0, shape);
  return { state, escaped };
}

describe("bakebot mascot motion", () => {
  it("settles a glance through the default spring", () => {
    let value = { position: 0, velocity: 0 };
    for (let frame = 0; frame < 240; frame += 1) {
      value = stepSpring(value, 11, 1 / 60);
    }

    expect(value.position).toBeCloseTo(11, 4);
    expect(value.velocity).toBeCloseTo(0, 4);
  });

  it("hangs the eye the same way past the border, all the way round every shape", () => {
    // The travel region is not an approximation of the tile: it is the tile
    // inset by the eye's radius less its overshoot, so a point anywhere on its
    // boundary puts the eye's rim exactly `overshoot` past the border, for the
    // tile to clip. If that inset were wrong for one shape the eye would float
    // short of its border or sink through it — and only in that shape.
    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      const shape = tileShape(name);
      for (let step = 0; step < 360; step += 1) {
        const angle = (step / 360) * Math.PI * 2;
        const farX = Math.cos(angle) * 60;
        const farY = Math.sin(angle) * 60;
        const distance = roundedRectDistance(
          farX,
          farY,
          shape.travelHalfX,
          shape.travelHalfY,
          shape.travelRadius,
        );
        const [nx, ny] = boundaryNormal(
          farX,
          farY,
          shape.travelHalfX,
          shape.travelHalfY,
          shape.travelRadius,
        );
        const edgeX = farX - nx * distance;
        const edgeY = farY - ny * distance;

        expect(
          roundedRectDistance(edgeX, edgeY, shape.halfX, shape.halfY, shape.radius),
        ).toBeCloseTo(-(TILE.eye - TILE.overshoot), 9);
      }
    }
  });

  it("never leaves the travel region however far past it the eye is asked to look", () => {
    for (const intent of [CORNER, WALL, { x: 60, y: 60 }, { x: 0, y: 120 }]) {
      expect(run(intent, 4).escaped).toBeLessThan(1e-6);
    }
  });

  it("meets a wall square on, whatever shape the tile is", () => {
    // Not to more places than that: on a circle the whole border is arc, so the
    // drift that keeps a resting eye alive slides it a fraction of a unit along
    // the rim and tilts the normal by a fraction of a degree with it.
    for (const shape of [DEFAULT_SHAPE, tileShape({ radius: 0 }), tileShape({ radius: 16 })]) {
      const wall = run(WALL, 3, shape).state;
      const [nx] = boundaryNormal(
        wall.x.position,
        wall.y.position,
        shape.travelHalfX,
        shape.travelHalfY,
        shape.travelRadius,
      );
      expect(nx).toBeCloseTo(-1, 3);
      expect(escapeOf(wall, shape)).toBeLessThanOrEqual(0);
      expect(escapeOf(wall, shape)).toBeGreaterThan(-1e-5);
      expect(wall.x.position).toBeLessThan(-shape.travelHalfX + 0.01);
    }
  });

  it("slides along the border rather than rebounding off it", () => {
    // The whole of what replaced collision. A point pushed past the left wall
    // comes back onto it having lost what it was leaving with and kept every
    // bit of what it was travelling along with — no restitution, no friction,
    // and so no step size for either of them to depend on.
    const outside = DEFAULT_SHAPE.travelHalfX + 1;
    const slid = contain(outside, 0, 40, 10);
    expect(slid.x).toBeCloseTo(DEFAULT_SHAPE.travelHalfX, 9);
    expect(slid.vx).toBe(0);
    expect(slid.vy).toBe(10);

    // Free of it, and leaving it, are both left alone.
    const free = contain(0, 0, 50, 50);
    expect(free).toEqual({ x: 0, y: 0, vx: 50, vy: 50 });
    expect(contain(outside, 0, -50, 0).vx).toBe(-50);
  });

  it("turns the face as far as the tile lets the eye travel, in every shape", () => {
    // "Near the border" and "looking that way" are one fact rather than two:
    // the turn is read off the eye's own distance from the centre, so it is
    // full at the border of whatever shape the mascot happens to live in.
    const [fullYaw] = facingAngles(DEFAULT_SHAPE.travelHalfX, 0);
    const [, fullPitch] = facingAngles(0, DEFAULT_SHAPE.travelHalfY);
    expect(fullYaw).toBeGreaterThan(0);
    expect(fullPitch).toBeGreaterThan(0);
    expect(facingAngles(0, 0)).toEqual([0, 0]);

    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      const shape = tileShape(name);
      // Same turn at the border of a narrow pill as at the border of a circle:
      // the range is the shape's own, so a smaller tile is not a smaller face.
      expect(facingAngles(shape.travelHalfX, 0, shape)[0]).toBeCloseTo(fullYaw, 9);
      expect(facingAngles(-shape.travelHalfX, 0, shape)[0]).toBeCloseTo(-fullYaw, 9);
      // And past it, which the simulation cannot reach but a caller can ask.
      expect(facingAngles(shape.travelHalfX * 4, 0, shape)[0]).toBeCloseTo(fullYaw, 9);

      const wall = run(WALL, 3, shape).state;
      expect(facingAngles(wall.x.position, wall.y.position, shape)[0]).toBeCloseTo(-fullYaw, 2);
    }

    // A tile no wider than the eye leaves nothing to travel and nothing to
    // read a turn from, rather than dividing by zero.
    expect(facingAngles(0, 0, tileShape({ halfX: 0, halfY: 0 }))).toEqual([0, 0]);
  });

  it("keeps the pair centred while turn changes its spacing and alignment", () => {
    // The simulation owns the pair's centre. The spherical projection owns
    // only the relationship between the two discs, or yaw/pitch would move the
    // face once through pose.x/y and a second time through `facingEyes`.
    const [restLeft, restRight] = facingEyes(0, 0);
    expect(restLeft.x).toBeCloseTo(-restRight.x, 9);
    expect(restLeft.scaleX).toBeCloseTo(1, 9);
    expect(restRight.scaleX).toBeCloseTo(1, 9);
    expect(restLeft.scaleY).toBeCloseTo(1, 9);
    expect(restLeft.y).toBe(0);

    // Face-on is the default readers see most often, so its seam is an
    // explicit geometry value rather than an accidental result of azimuth.
    const restGap = restRight.x - restLeft.x - 2 * MASCOT_GEOMETRY.eyes.radius;
    expect(restGap).toBeCloseTo(MASCOT_GEOMETRY.eyes.minimumGap, 9);

    const [fullYaw] = facingAngles(DEFAULT_SHAPE.travelHalfX, 0);
    const [left, right] = facingEyes(fullYaw, 0);
    expect(right.scaleX).toBeLessThan(0.75);
    expect(left.scaleX).toBeCloseTo(1, 1);
    expect(right.x - left.x).toBeLessThan(restRight.x - restLeft.x);
    expect(left.x).toBeCloseTo(-right.x, 9);
    expect(left.y).toBeCloseTo(-right.y, 9);
    // A full side look reaches the silhouette at every pitch, including the
    // diagonals. That is where a literal projection loses the leading disc
    // altogether; it bottoms out on `minimumScaleX` instead, so the face still
    // has two eyes at its furthest turn while the trailing one keeps its
    // ordinary width. Both directions obey the same rule rather than one side
    // depending on renderer clipping.
    const { minimumScaleX } = MASCOT_GEOMETRY.eyes;
    const [, fullPitch] = facingAngles(0, DEFAULT_SHAPE.travelHalfY);
    for (const pitch of [-fullPitch, 0, fullPitch]) {
      const [positiveLeft, positiveRight] = facingEyes(fullYaw, pitch);
      expect(positiveRight.scaleX).toBeCloseTo(minimumScaleX, 9);
      expect(positiveLeft.scaleX).toBeGreaterThan(0.9);

      const [negativeLeft, negativeRight] = facingEyes(-fullYaw, pitch);
      expect(negativeLeft.scaleX).toBeCloseTo(minimumScaleX, 9);
      expect(negativeRight.scaleX).toBeGreaterThan(0.9);
    }

    // And no turn at all, however far past the silhouette it is pushed, may
    // narrow a disc past that floor or leave one with no width to draw.
    for (let yaw = -180; yaw <= 180; yaw += 1) {
      for (const disc of facingEyes(yaw, 0)) {
        expect(disc.scaleX).toBeGreaterThanOrEqual(minimumScaleX - 1e-12);
        expect(disc.scaleX).toBeLessThanOrEqual(1 + 1e-12);
      }
    }

    // The midpoint is the local origin at every turn, and neither disc can
    // leave the space the one eye occupied.
    for (let yaw = -90; yaw <= 90; yaw += 1) {
      for (let pitch = -45; pitch <= 45; pitch += 3) {
        const pair = facingEyes(yaw, pitch);
        expect(pair[0].x + pair[1].x).toBeCloseTo(0, 12);
        expect(pair[0].y + pair[1].y).toBeCloseTo(0, 12);
        for (const disc of pair) {
          expect(Math.hypot(disc.x, disc.y) + MASCOT_GEOMETRY.eyes.radius).toBeLessThanOrEqual(
            TILE.eye + 1e-9,
          );
        }
      }
    }

    // Pitch alone keeps the eyes on one baseline because pose.y already moves
    // the pair. Once yaw creates different depths, pitch tilts around the same
    // midpoint instead of lifting both discs again.
    const [downLeft, downRight] = facingEyes(0, 12);
    expect(downLeft.y).toBeCloseTo(0, 12);
    expect(downRight.y).toBeCloseTo(0, 12);
    expect(downLeft.scaleX).toBeLessThan(1);
    expect(downLeft.rotation).toBeCloseTo(-downRight.rotation, 9);
    expect(downLeft.rotation).toBeLessThan(0);
    const [tiltLeft, tiltRight] = facingEyes(fullYaw, 12);
    expect(tiltLeft.y).toBeGreaterThan(tiltRight.y);
    expect(tiltLeft.y).toBeCloseTo(-tiltRight.y, 9);
  });

  it("keeps the discs from crossing along either projected axis", () => {
    const clearance = (yaw: number, pitch: number) => {
      const [left, right] = facingEyes(yaw, pitch);
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const distance = Math.hypot(dx, dy);
      const axisX = distance > 1e-6 ? dx / distance : 1;
      const axisY = distance > 1e-6 ? dy / distance : 0;
      const radius = MASCOT_GEOMETRY.eyes.radius;
      const support = (eye: typeof left) => {
        const rotation = (eye.rotation * Math.PI) / 180;
        const localX = axisX * Math.cos(rotation) + axisY * Math.sin(rotation);
        const localY = -axisX * Math.sin(rotation) + axisY * Math.cos(rotation);
        return Math.hypot(radius * eye.scaleX * localX, radius * eye.scaleY * localY);
      };
      return { gap: distance - support(left) - support(right), left, right };
    };

    // Collision is a two-dimensional constraint. Across arbitrary public
    // angles the projected ellipses preserve the declared default gap instead
    // of crossing or visually merging.
    for (let yaw = -90; yaw <= 90; yaw += 2) {
      for (let pitch = -45; pitch <= 45; pitch += 3) {
        expect(clearance(yaw, pitch).gap).toBeGreaterThanOrEqual(
          MASCOT_GEOMETRY.eyes.minimumGap - 1e-9,
        );
      }
    }

    // Edge-on with pitch puts the separation axis vertically through the
    // pair. A horizontal-only correction would fail this case by skating both
    // discs sideways instead of resolving where they meet.
    const vertical = clearance(90, 12);
    expect(Math.abs(vertical.left.y)).toBeGreaterThan(Math.abs(vertical.left.x));
    expect(vertical.left.y).toBeCloseTo(-vertical.right.y, 9);
    expect(vertical.gap).toBeCloseTo(MASCOT_GEOMETRY.eyes.minimumGap, 9);
  });

/*
 * Proof that the pair never collapses into itself.
 *
 * The test above measures the seam the way `separateEyes` does — along the
 * centre line, through the same support function. That is circular: it shows
 * the solver agrees with itself, not that the two shapes a reader actually
 * sees stay apart. Everything below decides that geometrically instead, by
 * walking one drawn ellipse's rim and asking the other whether the point is
 * inside it. No support function, no separation axis, no shared algebra.
 *
 * The sweep is over the angles the face can really hold, which is not a
 * rectangle: `facingAngles` maps the travel region onto them, so the reachable
 * set is that region's shape and the diagonals are its corners — the poses
 * that lost an eye. Each shape is swept through its own region rather than
 * through one assumed envelope.
 */
describe("the two eyes never collapse into each other, at any angle", () => {
  const { radius, minimumGap, minimumScaleX } = MASCOT_GEOMETRY.eyes;
  const RIM = 180;

  /*
   * What a reader is promised, in absolute terms.
   *
   * These are deliberately not `minimumGap` and `minimumScaleX`. A test that
   * measures the geometry against the very constant that produced it proves
   * nothing: drop the constant to zero and the assertion drops with it. So the
   * numbers below are what the mascot owes whoever is looking at it — clear
   * air a reader can see, an eye still wide enough to be one, enough of it
   * left after the tile has clipped it — and the constants have to keep that
   * promise rather than define it. The seam retains tuning room; the half-eye
   * floor is exact because losing more than half is the regression contract.
   */
  /** View units of daylight between the two rims. Two of them is 1px at 32px. */
  const CLEAR_AIR = 2;
  /** How wide a turned disc must still be drawn, against its face-on width. */
  const DRAWN_WIDTH = 0.5;
  /** At least half of each drawn eye must survive the tile clip. */
  const SURVIVING_EYE = 0.5;
  /**
   * And half of a face-on eye must survive it *across* — area is not enough on
   * its own. A disc clipped down one side keeps most of its area while what a
   * reader sees narrows to a bar, which is what the leading eye became once
   * the projection had already halved it and the tile took its bite out of
   * what was left. Measured against the face-on width, not the drawn one, so
   * narrowing the disc cannot satisfy it by lowering its own bar.
   */
  const VISIBLE_WIDTH = 0.5;

  const semiAxes = (eye: FacingEye) => [radius * eye.scaleX, radius * eye.scaleY] as const;

  /** A point in one ellipse's local axes, rotated into the 2D render plane. */
  const projectedPoint = (eye: FacingEye, x: number, y: number) => {
    const rotation = (eye.rotation * Math.PI) / 180;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return [eye.x + cosine * x - sine * y, eye.y + sine * x + cosine * y] as const;
  };

  /**
   * How far outside `other` the nearest point of `eye`'s rim is, measured
   * radially from `other`'s centre. Positive is clear air between the two
   * drawn shapes; zero or less means a reader sees them touching or merged.
   */
  const clearanceBetween = (eye: FacingEye, other: FacingEye): number => {
    const [ea, eb] = semiAxes(eye);
    const [oa, ob] = semiAxes(other);
    // A disc with no width or height is not a shape a reader can see cross
    // anything. The floors are asserted separately; this only judges overlap.
    if (ea < 1e-9 || eb < 1e-9 || oa < 1e-9 || ob < 1e-9) return Infinity;

    let nearest = Infinity;
    for (let i = 0; i < RIM; i += 1) {
      const t = (i / RIM) * Math.PI * 2;
      const [screenX, screenY] = projectedPoint(eye, ea * Math.cos(t), eb * Math.sin(t));
      const dx = screenX - other.x;
      const dy = screenY - other.y;
      const rotation = (-other.rotation * Math.PI) / 180;
      const px = Math.cos(rotation) * dx - Math.sin(rotation) * dy;
      const py = Math.sin(rotation) * dx + Math.cos(rotation) * dy;
      const away = Math.hypot(px, py);
      if (away < 1e-12) return -oa;
      // `other`'s own radius along the ray this rim point sits on.
      const along = Math.hypot((oa * py) / away, (ob * px) / away);
      nearest = Math.min(nearest, away - (oa * ob) / along);
    }
    return nearest;
  };

  /** The worst clearance either way round, so containment counts as a cross. */
  const clearanceOf = (yaw: number, pitch: number): number => {
    const [left, right] = facingEyes(yaw, pitch);
    return Math.min(clearanceBetween(left, right), clearanceBetween(right, left));
  };

  /** Every turn the face can hold in one shape, its diagonals included. */
  const reachableAngles = (shape: TileShape, step: number): [number, number][] => {
    const angles: [number, number][] = [];
    for (let x = -shape.travelHalfX; x <= shape.travelHalfX; x += step) {
      for (let y = -shape.travelHalfY; y <= shape.travelHalfY; y += step) {
        if (travelDistance(x, y, shape) > 1e-9) continue;
        angles.push(facingAngles(x, y, shape));
      }
    }
    return angles;
  };

  const AREA = 48;
  /* Area actually painted as a fraction of this projected disc. The absolute
   * scale floor asserted separately is what prevents a zero-area eye from
   * passing this ratio vacuously; together they promise a half-width eye with
   * at least half of that drawn shape still inside the tile. */
  const visible = (eye: FacingEye, x: number, y: number, shape: TileShape) => {
    const [a, b] = semiAxes(eye);
    if (a < 1e-9 || b < 1e-9) return 0;
    let inside = 0;
    let total = 0;
    for (let i = 0; i < AREA; i += 1) {
      for (let j = 0; j < AREA; j += 1) {
        const u = ((i + 0.5) / AREA) * 2 - 1;
        const v = ((j + 0.5) / AREA) * 2 - 1;
        if (u * u + v * v > 1) continue;
        total += 1;
        const [discX, discY] = projectedPoint(eye, a * u, b * v);
        const px = x + discX;
        const py = y + discY;
        if (roundedRectDistance(px, py, shape.halfX, shape.halfY, shape.radius) <= 0) {
          inside += 1;
        }
      }
    }
    return inside / total;
  };

  /** The exact point where one ray from the centre meets the travel border. */
  const edgeAt = (shape: TileShape, degrees: number): [number, number] => {
    const angle = (degrees * Math.PI) / 180;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let inside = 0;
    let outside = Math.hypot(shape.travelHalfX, shape.travelHalfY) + 1;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const middle = (inside + outside) / 2;
      if (travelDistance(dx * middle, dy * middle, shape) <= 0) inside = middle;
      else outside = middle;
    }
    return [dx * inside, dy * inside];
  };

  it("declares constants that keep those promises", () => {
    // The sweeps below prove the geometry honours whatever the constants say.
    // This proves the constants themselves still say enough — a floor lowered
    // past what a reader is owed fails here, before any angle is swept.
    expect(minimumScaleX).toBeGreaterThanOrEqual(DRAWN_WIDTH);
    expect(minimumGap).toBeGreaterThanOrEqual(CLEAR_AIR);
  });

  it("keeps clear air between the drawn eyes everywhere the face can turn", () => {
    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      const shape = tileShape(name);
      let worst = Infinity;
      for (const [yaw, pitch] of reachableAngles(shape, 1)) {
        worst = Math.min(worst, clearanceOf(yaw, pitch));
      }
      expect({ shape: name, clear: worst > CLEAR_AIR }).toEqual({ shape: name, clear: true });
      // And the seam a reader sees is the one the geometry declares, measured
      // without the solver's own algebra. This one is a consistency check on
      // top of the promise above, not a substitute for it.
      expect(worst).toBeCloseTo(minimumGap, 2);
    }
  });

  it("keeps the projected narrowing from turning sideways at every reachable turn", () => {
    /*
     * `rotation` orients the axis produced by combined yaw and pitch. Pitch is
     * deliberately gentler than yaw, so that axis may tip enough to sell the
     * surface without turning a narrow eye into a horizontal lid. The shipped
     * renderers keep the blink screen-vertical outside this projection.
     */
    const SIDEWAYS = 0.35;

    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      const shape = tileShape(name);
      let worst = 0;
      let worstAt = "";
      for (let x = -shape.travelHalfX; x <= shape.travelHalfX; x += 0.5) {
        for (let y = -shape.travelHalfY; y <= shape.travelHalfY; y += 0.5) {
          if (travelDistance(x, y, shape) > 1e-9) continue;
          const [yaw, pitch] = facingAngles(x, y, shape);
          for (const disc of facingEyes(yaw, pitch)) {
            // The sideways share of the projected narrowing axis.
            const across = Math.abs(Math.sin((disc.rotation * Math.PI) / 180));
            if (across > worst) {
              worst = across;
              worstAt = `${name} at (${x}, ${y})`;
            }
          }
        }
      }
      expect({ shape: name, staysUpright: worst <= SIDEWAYS, worstAt }).toEqual({
        shape: name,
        staysUpright: true,
        worstAt,
      });
    }
  });

  it("leaves a disc drawn round with no angle to be turned by", () => {
    // The guard behind the test above. An axis is only meaningful while there
    // is a narrowing to orient; without this a round eye carries whatever the
    // projection happened to produce, and the lid inherits it.
    for (let yaw = -180; yaw <= 180; yaw += 1) {
      for (let pitch = -80; pitch <= 80; pitch += 5) {
        for (const disc of facingEyes(yaw, pitch)) {
          if (disc.scaleX >= disc.scaleY - 1e-9) expect(disc.rotation).toBe(0);
        }
      }
    }
  });

  it("keeps them apart on each of the four diagonals by name", () => {
    // The reported failure was diagonal: the corners of the travel region are
    // where yaw and pitch are both extreme, and where an eye disappeared.
    const shape = tileShape("square");
    const corners = {
      "top-left": [-shape.travelHalfX, -shape.travelHalfY],
      "top-right": [shape.travelHalfX, -shape.travelHalfY],
      "bottom-left": [-shape.travelHalfX, shape.travelHalfY],
      "bottom-right": [shape.travelHalfX, shape.travelHalfY],
    } as const;

    for (const [corner, [x, y]] of Object.entries(corners)) {
      const [yaw, pitch] = facingAngles(x!, y!, shape);
      const [left, right] = facingEyes(yaw, pitch);
      // Named in the failure message, so a regression says which diagonal.
      expect({ corner, clear: clearanceOf(yaw, pitch) > CLEAR_AIR }).toEqual({
        corner,
        clear: true,
      });
      // And both are still eyes there, not slivers the tile can finish off.
      // This is the pose that used to project the leading disc to no width.
      for (const disc of [left, right]) {
        expect({ corner, drawn: disc.scaleX >= DRAWN_WIDTH }).toEqual({ corner, drawn: true });
        expect(disc.scaleY).toBeGreaterThan(0);
      }
    }
  });

  it("holds the same way far past any turn the face is allowed", () => {
    // Nothing clamps `facingEyes` itself, and a later change to YAW_MAX or to
    // the azimuth would widen the reachable set silently. Sweeping a whole
    // revolution means that change cannot reach a reader as a merged pair.
    for (let yaw = -180; yaw <= 180; yaw += 3) {
      for (let pitch = -80; pitch <= 80; pitch += 5) {
        expect(clearanceOf(yaw, pitch)).toBeGreaterThan(CLEAR_AIR);
      }
    }
  });

  it("keeps at least half of both eyes visible along every tile edge", () => {
    // The other way a pair collapses to one: not by merging, but by a turn
    // carrying the leading disc so far past the border that the tile clips all
    // of it. Measured as drawn — the ellipse the renderer fills, against the
    // rounded rect it clips to.
    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      const shape = tileShape(name);
      let worst = 1;
      // Walk the actual border by direction, including every rounded arc and
      // the four exact square corners. Interior poses clip less of an eye.
      for (let angle = 0; angle < 360; angle += 1) {
        const [x, y] = edgeAt(shape, angle);
        const [yaw, pitch] = facingAngles(x, y, shape);
        for (const eye of facingEyes(yaw, pitch)) {
          worst = Math.min(worst, visible(eye, x, y, shape));
        }
      }
      expect({ shape: name, keepsAnEye: worst >= SURVIVING_EYE }).toEqual({
        shape: name,
        keepsAnEye: true,
      });
    }
  });

  it("never lets the tile shave the leading eye down to a bar", () => {
    // The regression the area test above cannot see. Both constants it depends
    // on are real: raise `TILE.overshoot` and the tile eats further in, lower
    // `minimumScaleX` and there is less to eat, and either one alone drops the
    // eye a reader sees below half a face-on width.
    const SPAN = 240;
    const faceOn = 2 * radius;

    /** How wide the painted part of one disc is, along the render plane's x. */
    const paintedWidth = (eye: FacingEye, x: number, y: number, shape: TileShape) => {
      const [a, b] = semiAxes(eye);
      let low = Infinity;
      let high = -Infinity;
      for (let i = 0; i < SPAN; i += 1) {
        const t = (i / SPAN) * Math.PI * 2;
        // Walk the rim, and for each rim point the chord in to the centre —
        // the tile's border may cut anywhere between the two.
        for (let step = 0; step <= 12; step += 1) {
          const scale = step / 12;
          const [discX, discY] = projectedPoint(eye, a * scale * Math.cos(t), b * scale * Math.sin(t));
          const px = x + discX;
          const py = y + discY;
          if (roundedRectDistance(px, py, shape.halfX, shape.halfY, shape.radius) > 0) continue;
          low = Math.min(low, discX);
          high = Math.max(high, discX);
        }
      }
      return high < low ? 0 : high - low;
    };

    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      const shape = tileShape(name);
      let worst = Infinity;
      let worstAt = "";
      for (let angle = 0; angle < 360; angle += 2) {
        const [x, y] = edgeAt(shape, angle);
        const [yaw, pitch] = facingAngles(x, y, shape);
        for (const eye of facingEyes(yaw, pitch)) {
          const width = paintedWidth(eye, x, y, shape) / faceOn;
          if (width < worst) {
            worst = width;
            worstAt = `${name} at ${angle} degrees`;
          }
        }
      }
      expect({ shape: name, staysAnEye: worst >= VISIBLE_WIDTH, worstAt }).toEqual({
        shape: name,
        staysAnEye: true,
        worstAt,
      });
    }
  });

  it("still lets the tile take a bite out of the leading eye", () => {
    /*
     * The other half of that promise, and the reason the width above is not
     * simply bought by widening the disc until nothing is clipped. An eye
     * whose rim stops on the border reads as a ball resting inside a box: it
     * never goes round the side of the head, and the far look stops reading as
     * a turn. So the bite is bounded both ways — enough of it for a reader to
     * see, not so much that the eye is pared back to a bar.
     */
    const LEAST = 0.1;
    const MOST = 0.25;

    for (const name of Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[]) {
      const shape = tileShape(name);
      // A full sideways look, which is the pose that carries the leading disc
      // furthest past the border. Straight up or down clips nothing in any
      // shape, because pitch is the gentler of the two turns.
      const [yaw, pitch] = facingAngles(shape.travelHalfX, 0, shape);
      const leading = facingEyes(yaw, pitch)[1];
      const bite = 1 - visible(leading, shape.travelHalfX, 0, shape);
      expect({ shape: name, bitten: bite >= LEAST && bite <= MOST, bite }).toEqual({
        shape: name,
        bitten: true,
        bite,
      });
    }
  });
});

  it("holds one steady shape against a surface instead of ringing on it", () => {
    // A signed tangent flips on noise where the contact normal is diagonal,
    // which drove this spring at its own frequency and pinned the eye at full
    // deformation for as long as it touched.
    const state = run(CORNER, 2).state;
    let low = Infinity;
    let high = -Infinity;
    for (let step = 0; step < Math.round(1 / STEP); step += 1) {
      advanceEye(state, CORNER, STEP, 2 + step * STEP);
      low = Math.min(low, stretchOf(state));
      high = Math.max(high, stretchOf(state));
    }

    expect(high - low).toBeLessThan(0.02);
    expect(high).toBeLessThan(MAX_STRETCH);
  });

  it("counts a look held at the border as contact, and as having arrived", () => {
    const state = run(CORNER, 2).state;
    expect(state.contact).toBeGreaterThan(0.9);
    expect(escapeOf(state)).toBeLessThanOrEqual(0);
    expect(escapeOf(state)).toBeGreaterThan(-1e-5);
    // Arrival is judged on travel, and a look being held is not travelling —
    // the outward push is taken back every step rather than banked as a
    // rebound, so the eye sits at its limit instead of jittering on it.
    expect(state.speed).toBeLessThan(1);
    expect(Math.hypot(state.x.velocity, state.y.velocity)).toBeLessThan(1);
  });

  it("comes back round after a look at the border is let go", () => {
    const state = createEyeState();
    const { clock } = drive(state, CORNER, 2);
    drive(state, { x: 0, y: 0 }, 1.5, clock);

    expect(state.contact).toBe(0);
    expect(stretchOf(state)).toBeLessThan(0.02);
  });

  it("is never perfectly still once it has arrived", () => {
    const state = createEyeState();
    const { clock } = drive(state, INSIDE, 3);

    let low = Infinity;
    let high = -Infinity;
    for (let step = 0; step < Math.round(1 / STEP); step += 1) {
      advanceEye(state, INSIDE, STEP, clock + step * STEP);
      low = Math.min(low, state.x.position);
      high = Math.max(high, state.x.position);
    }
    expect(high - low).toBeGreaterThan(0.05);
  });

  it("preserves area through any deformation and eases into its ceiling", () => {
    for (const [x, y] of [
      [0, 0],
      [0.2, -0.1],
      [-0.3, 0.3],
      [10, 10],
    ]) {
      const { stretch, squash } = deformation(x!, y!);
      expect(stretch * squash).toBeCloseTo(1, 12);
      expect(stretch - 1).toBeLessThanOrEqual(MAX_STRETCH);
    }

    // Soft, not clipped: a small drive is passed through almost untouched, a
    // huge one approaches the ceiling without ever sitting on it.
    expect(deformation(0.02, 0).stretch - 1).toBeCloseTo(0.02, 3);
    expect(deformation(10, 0).stretch - 1).toBeLessThan(MAX_STRETCH);
    expect(deformation(10, 0).stretch - 1).toBeGreaterThan(MAX_STRETCH * 0.99);
    expect(deformation(0, 0).angle).toBe(0);
  });

  it("reads the stretch axis as an axis, so a half turn is the same shape", () => {
    const straight = deformation(0.3, 0.4);
    const flipped = deformation(-0.3, -0.4);
    expect(flipped.stretch).toBeCloseTo(straight.stretch, 12);
    expect(Math.abs(flipped.angle - straight.angle)).toBeCloseTo(90, 12);
  });

  it("shuts faster than it opens", () => {
    expect(blinkClosure(-1)).toBe(0);
    expect(blinkClosure(0)).toBe(0);
    expect(blinkClosure(BLINK_CYCLE)).toBe(0);

    // The two strokes are found rather than assumed, so this reads the curve
    // the character actually has instead of restating the constants behind it.
    let firstFull = Infinity;
    let lastFull = 0;
    let lastShut = 0;
    for (let phase = 0; phase <= BLINK_CYCLE; phase += 0.0005) {
      const closure = blinkClosure(phase);
      expect(closure).toBeGreaterThanOrEqual(0);
      expect(closure).toBeLessThanOrEqual(1);
      if (closure >= 0.999) {
        firstFull = Math.min(firstFull, phase);
        lastFull = Math.max(lastFull, phase);
      }
      if (closure > 0.001) lastShut = Math.max(lastShut, phase);
    }

    expect(firstFull).toBeLessThan(0.08);
    expect(lastShut - lastFull).toBeGreaterThan(1.5 * firstFull);

    // And each stroke carries its own curve rather than sharing one symmetric
    // ease. Half way down the lid has barely left the eye; half way back up it
    // is already mostly clear of it and only the unhurried tail is left. A
    // smoothstep either side would read 0.5 at both of these.
    expect(blinkClosure(firstFull / 2)).toBeLessThan(0.3);
    expect(blinkClosure((lastFull + lastShut) / 2)).toBeLessThan(0.3);
  });

  it("closes the lid onto the eye instead of shrinking the eye", () => {
    // Both renderers flatten a disc about its own centre and then drop it by
    // `lid.drop`. Flattening alone lifts the lower rim as much as it lowers the
    // upper one, which reads as the eye being pulled up off its own baseline
    // rather than as a lid coming down over it. `drop` is what cancels that, so
    // the invariant is that the bottom edge does not move at all.
    const { lid, eyes } = MASCOT_GEOMETRY;
    const bottom = (closure: number) =>
      closure * lid.drop + eyes.radius * (1 - closure * lid.close);

    for (let phase = 0; phase <= BLINK_CYCLE; phase += 0.001) {
      expect(bottom(blinkClosure(phase))).toBeCloseTo(eyes.radius, 9);
    }

    // The same has to hold on a diagonally turned face. Blink stays vertical in
    // screen space outside the rotated projection, so its drop uses the
    // ellipse's support on screen Y or the lid sinks past the rim it lands on.
    for (const yaw of [-30, -12, 0, 12, 30]) {
      for (const eye of facingEyes(yaw, 12)) {
        const rotation = (eye.rotation * Math.PI) / 180;
        const verticalScale = Math.hypot(
          eye.scaleX * Math.sin(rotation),
          eye.scaleY * Math.cos(rotation),
        );
        const rim = (closure: number) =>
          eye.y +
          closure * lid.drop * verticalScale +
          eyes.radius * verticalScale * (1 - closure * lid.close);
        expect(rim(1)).toBeCloseTo(rim(0), 9);
      }
    }
    // And the top edge is what travels: from the eye's own top nearly to its
    // bottom, which is the whole of the closure.
    const top = (closure: number) =>
      closure * lid.drop - eyes.radius * (1 - closure * lid.close);
    expect(top(0)).toBeCloseTo(-eyes.radius, 9);
    expect(top(1)).toBeCloseTo(eyes.radius - 2 * eyes.radius * (1 - lid.close), 9);
  });

  it("answers an ordinary glance without turning the whole face to it", () => {
    const glance = run(GLANCE, 2).state;
    const travel = Math.hypot(glance.x.position, glance.y.position);

    // The deadzone is subtracted from the look rather than gating it, so a
    // glance just past it is answered by just as much travel — otherwise the
    // eyes would jump the whole deadzone the moment a look cleared it.
    expect(travel).toBeCloseTo(Math.hypot(GLANCE.x, GLANCE.y) - resolveTuning().deadzone, 0);
    expect(glance.contact).toBe(0);

    // A look inside the deadzone is not worth moving for at all: without it
    // the face would twitch at every point of interest near its own centre.
    const inside = run({ x: 3, y: 0 }, 2).state;
    expect(Math.hypot(inside.x.position, inside.y.position)).toBeLessThan(1);
  });

  it("still turns all the way to the border for a look far past the deadzone", () => {
    // "At the border" is the shape's own question, not a distance from the
    // centre: on a circle every border point is `travelHalf` out, on a square
    // the corner is further.
    const state = run(CORNER, 3).state;
    expect(escapeOf(state)).toBeLessThanOrEqual(0);
    expect(escapeOf(state)).toBeGreaterThan(-1e-5);
    expect(state.contact).toBeGreaterThan(0.8);
  });

  it("treats every intent past the border as the same full turn", () => {
    // Once the requested look is outside the travel region, extra distance is
    // direction rather than force. Otherwise a caller using 240 instead of 60
    // would slam the same face into the same pose several times harder.
    const tuning = resolveTuning({ restlessness: 0, deadzone: 4 });
    const near = createEyeState();
    const far = createEyeState();

    for (let step = 1; step <= 240; step += 1) {
      const clock = step * STEP;
      advanceEye(near, { x: 60, y: 0 }, STEP, clock, tuning);
      advanceEye(far, { x: 240, y: 0 }, STEP, clock, tuning);
      expect(far.x.position).toBe(near.x.position);
      expect(far.x.velocity).toBe(near.x.velocity);
      expect(far.y.position).toBe(near.y.position);
    }

    expect(escapeOf(near)).toBeCloseTo(0, 6);
    expect(near.contact).toBeGreaterThan(0.8);
  });

  it("keeps moving even with nothing to look at", () => {
    const state = createEyeState();
    const { clock } = drive(state, { x: 0, y: 0 }, 2);

    let low = Infinity;
    let high = -Infinity;
    for (let step = 0; step < Math.round(1.5 / STEP); step += 1) {
      advanceEye(state, { x: 0, y: 0 }, STEP, clock + step * STEP);
      low = Math.min(low, state.x.position);
      high = Math.max(high, state.x.position);
    }
    expect(high - low).toBeGreaterThan(0.1);
  });

  it("chooses a near point of interest more often than a far one", () => {
    const random = createRandom(7);
    const counts = new Array(DEFAULT_GAZE_INTENTS.length).fill(0);
    let current = 0;
    for (let pick = 0; pick < 20000; pick += 1) {
      const next = nextIntentIndex(random, current, DEFAULT_GAZE_INTENTS);
      expect(next).not.toBe(current);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(DEFAULT_GAZE_INTENTS.length);
      counts[next] += 1;
      current = next;
    }

    const reach = (index: number) =>
      Math.hypot(DEFAULT_GAZE_INTENTS[index]!.x, DEFAULT_GAZE_INTENTS[index]!.y);
    const near = counts.reduce(
      (total: number, count: number, index: number) => (reach(index) < 15 ? total + count : total),
      0,
    );
    const far = counts.reduce(
      (total: number, count: number, index: number) => (reach(index) > 20 ? total + count : total),
      0,
    );

    expect(near).toBeGreaterThan(far * 2);
    expect(far).toBeGreaterThan(0);
    expect(intentWeight({ x: 0, y: 0, hold: 1 })).toBeGreaterThan(
      intentWeight({ x: 26, y: -26, hold: 1 }),
    );
  });

  it("aims some points of interest past the border, which is what makes corners happen", () => {
    const reach = DEFAULT_GAZE_INTENTS.map((intent) => travelDistance(intent.x, intent.y));

    expect(reach.filter((distance) => distance > 0).length).toBeGreaterThanOrEqual(3);
    expect(reach.filter((distance) => distance < 0).length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_GAZE_INTENTS.every((intent) => intent.hold >= 0.5)).toBe(true);
  });

  it("keeps invalid runtime gaze data out of the physics", () => {
    const normalized = normalizeGazeIntents([
      { x: Number.NaN, y: 0, hold: 1 },
      { x: 0, y: Number.POSITIVE_INFINITY, hold: 1 },
      { x: 0, y: 0, hold: 0 },
      { x: 1e300, y: -1e300, hold: 1e300 },
    ]);

    expect(normalized).toEqual([{ x: 256, y: -256, hold: 30 }]);
    expect(normalizeGazeIntents([])).toBe(DEFAULT_GAZE_INTENTS);

    const state = createEyeState();
    drive(state, normalized[0]!, 2);
    expect(Number.isFinite(state.x.position)).toBe(true);
    expect(Number.isFinite(state.y.position)).toBe(true);
    expect(escapeOf(state)).toBeLessThanOrEqual(1e-6);
  });
});

describe("the mascot's life in each state", () => {
  it("stays well inside the tile while attending, so the pose is what moves it", () => {
    // The CSS pose layer and the simulation write different elements, and they
    // would read as one confused mark if both carried the eyes across the tile.
    // Attending is a glance, never a turn of the face.
    for (const intent of ATTENTIVE_GAZE_INTENTS) {
      const state = run(intent, 2).state;
      expect(Math.hypot(state.x.position, state.y.position)).toBeLessThan(
        DEFAULT_SHAPE.travelHalfX / 4,
      );
      expect(state.contact).toBe(0);
    }
  });

  it("is still alive while attending", () => {
    const state = createEyeState();
    const { clock } = drive(state, ATTENTIVE_GAZE_INTENTS[1]!, 2);

    let low = Infinity;
    let high = -Infinity;
    for (let step = 0; step < Math.round(1.5 / STEP); step += 1) {
      advanceEye(state, ATTENTIVE_GAZE_INTENTS[1]!, STEP, clock + step * STEP);
      low = Math.min(low, state.x.position);
      high = Math.max(high, state.x.position);
    }

    // Alive, not still: attending never crosses the tile, but drift keeps it
    // off any one point. A frozen mascot at this size reads as a broken one.
    expect(high - low).toBeGreaterThan(0.05);
  });

  it("shuts the eye's own motion only where the pose has already shut it", () => {
    const closed = Object.entries(STATE_GAZE)
      .filter(([, gaze]) => gaze === null)
      .map(([name]) => name);

    expect(closed).toEqual(["Exited"]);
  });
});

describe("hardening of the simulation boundary", () => {
  it("refuses degenerate step sizes instead of hanging or exploding", () => {
    // A zero step would divide the arrival speed by zero; speed Infinity never
    // falls below SETTLE_SPEED, so the gaze dwell would stall forever.
    const state = createEyeState();
    advanceEye(state, CORNER, 0, 0);
    advanceEye(state, CORNER, -1, 0);
    advanceEye(state, CORNER, Number.NaN, 0);

    expect(state.x.position).toBe(0);
    expect(state.x.velocity).toBe(0);
    expect(Number.isFinite(state.speed)).toBe(true);
    expect(isBlinking(state)).toBe(false);
  });

  it("stays stable and contained when driven far coarser than the sim's own step", () => {
    // 1/30 s steps would explode the stiff gaze spring without subdivision.
    const state = createEyeState();
    let escaped = -Infinity;
    for (let frame = 0; frame < 60; frame += 1) {
      advanceEye(state, CORNER, 1 / 30, (frame + 1) / 30);
      escaped = Math.max(escaped, escapeOf(state));
    }

    expect(escaped).toBeLessThan(1e-6);
    expect(Number.isFinite(state.x.position)).toBe(true);
    expect(state.contact).toBeGreaterThan(0.8);
  });

  it("heals a poisoned spring back to rest instead of staying NaN forever", () => {
    const state = createEyeState();
    drive(state, CORNER, 1);

    state.x = { position: Number.NaN, velocity: Number.NaN };
    state.jellyY = { position: Number.POSITIVE_INFINITY, velocity: 0 };
    state.blinkPhase = Number.NaN;
    drive(state, INSIDE, 1);

    expect(Number.isFinite(state.x.position)).toBe(true);
    expect(Number.isFinite(state.jellyY.position)).toBe(true);
    expect(Number.isFinite(blinkClosure(state.blinkPhase))).toBe(true);

    // Recovery means behaviour, not just finiteness: the eye still travels.
    drive(state, CORNER, 2);
    expect(state.contact).toBeGreaterThan(0.8);
  });

  it("reads a non-finite intent as looking at the centre", () => {
    const state = run({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, 2).state;

    expect(Number.isFinite(state.x.position)).toBe(true);
    expect(Number.isFinite(state.y.position)).toBe(true);
    expect(Math.hypot(state.x.position, state.y.position)).toBeLessThan(DEFAULT_SHAPE.travelHalfX);
  });

  it("leaves a degenerate spring step untouched rather than poisoning it", () => {
    const value = { position: 3, velocity: -2 };
    expect(stepSpring(value, 10, 0)).toBe(value);
    expect(stepSpring(value, 10, Number.NaN)).toBe(value);

    const exploded = stepSpring(value, 1e300, 1e300);
    expect(exploded).toEqual({ position: 0, velocity: 0 });
  });

  it("falls back to the built-in gaze when runtime data is not an array", () => {
    expect(normalizeGazeIntents(5 as unknown as GazeIntent[])).toBe(DEFAULT_GAZE_INTENTS);
    expect(normalizeGazeIntents("look" as unknown as GazeIntent[])).toBe(DEFAULT_GAZE_INTENTS);
    expect(normalizeGazeIntents(null as unknown as GazeIntent[])).toBe(DEFAULT_GAZE_INTENTS);
  });

  it("keeps the signed distance field sane for a degenerate corner radius", () => {
    // A radius past the smaller half extent clamps to the largest round that
    // fits, which for a square tile is the inscribed circle.
    expect(roundedRectDistance(0, 0, 30, 30, 40)).toBeCloseTo(-30, 9);

    const [nx, ny] = boundaryNormal(35, 0, 30, 30, 40);
    expect(Number.isFinite(nx)).toBe(true);
    expect(Number.isFinite(ny)).toBe(true);
    expect(Math.hypot(nx, ny)).toBeCloseTo(1, 9);
  });
});
