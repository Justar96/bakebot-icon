import { describe, expect, it } from "bun:test";

/**
 * The properties the mark's idle behaviour must keep.
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
} from "../src/eye";
import {
  ATTENTIVE_GAZE_INTENTS,
  createRandom,
  DEFAULT_GAZE_INTENTS,
  intentWeight,
  nextIntentIndex,
  normalizeGazeIntents,
} from "../src/gaze";
import {
  boundaryNormal,
  resolveBoundary,
  roundedRectDistance,
  TILE,
  travelDistance,
  TRAVEL_HALF,
  TRAVEL_RADIUS,
} from "../src/geometry";
import { stepSpring } from "../src/spring";
import { STATE_GAZE } from "../src/states";
import type { GazeIntent } from "../src/types";

const STEP = 1 / 240;
const CORNER = { x: 26, y: -26 };
const WALL = { x: -32, y: 0 };
const INSIDE = { x: 0, y: -9 };
const GLANCE = { x: 11, y: -6 };

/** How far outside its travel region the eye centre is; negative is inside. */
const escapeOf = (state: EyeState) => travelDistance(state.x.position, state.y.position);

const stretchOf = (state: EyeState) =>
  deformation(state.jellyX.position, state.jellyY.position).stretch - 1;

function drive(state: EyeState, intent: { x: number; y: number }, seconds: number, from = 0) {
  let clock = from;
  let escaped = -Infinity;
  for (let step = 0; step < Math.round(seconds / STEP); step += 1) {
    clock += STEP;
    advanceEye(state, intent, STEP, clock);
    escaped = Math.max(escaped, escapeOf(state));
  }
  return { clock, escaped };
}

function run(intent: { x: number; y: number }, seconds: number) {
  const state = createEyeState();
  const { escaped } = drive(state, intent, seconds);
  return { state, escaped };
}

describe("gisx icon motion", () => {
  it("settles a glance through the default spring", () => {
    let value = { position: 0, velocity: 0 };
    for (let frame = 0; frame < 240; frame += 1) {
      value = stepSpring(value, 11, 1 / 60);
    }

    expect(value.position).toBeCloseTo(11, 4);
    expect(value.velocity).toBeCloseTo(0, 4);
  });

  it("collides on the tile's own border line, all the way round it", () => {
    for (let step = 0; step < 360; step += 1) {
      const angle = (step / 360) * Math.PI * 2;
      const farX = Math.cos(angle) * 60;
      const farY = Math.sin(angle) * 60;
      const distance = roundedRectDistance(farX, farY, TRAVEL_HALF, TRAVEL_RADIUS);
      const [nx, ny] = boundaryNormal(farX, farY, TRAVEL_HALF, TRAVEL_RADIUS);
      const edgeX = farX - nx * distance;
      const edgeY = farY - ny * distance;

      // With the eye centre on its own boundary, the eye's rim sits exactly on
      // the tile's border — never short of it, and never through it.
      expect(roundedRectDistance(edgeX, edgeY, TILE.half, TILE.radius)).toBeCloseTo(-TILE.eye, 9);
    }
  });

  it("never leaves the travel region however far past it the eye is asked to look", () => {
    for (const intent of [CORNER, WALL, { x: 60, y: 60 }, { x: 0, y: 120 }]) {
      expect(run(intent, 4).escaped).toBeLessThan(1e-6);
    }
  });

  it("meets a corner on the diagonal and a wall square on", () => {
    const corner = run(CORNER, 3).state;
    expect(corner.cornerness).toBeGreaterThan(0.9);
    expect(Math.abs(corner.x.position)).toBeGreaterThan(TRAVEL_HALF - TRAVEL_RADIUS);
    expect(Math.abs(corner.y.position)).toBeGreaterThan(TRAVEL_HALF - TRAVEL_RADIUS);

    const wall = run(WALL, 3).state;
    expect(wall.cornerness).toBeLessThan(0.05);
    expect(wall.normalX).toBeCloseTo(-1, 6);
    expect(wall.x.position).toBeCloseTo(-TRAVEL_HALF, 6);
  });

  it("spreads along the surface it is pressed against, not into it", () => {
    for (const intent of [CORNER, WALL]) {
      const state = run(intent, 3).state;
      expect(state.press).toBeGreaterThan(0.8);
      expect(stretchOf(state)).toBeGreaterThan(0.1);

      const radians =
        (deformation(state.jellyX.position, state.jellyY.position).angle * Math.PI) / 180;
      const intoWall = Math.cos(radians) * state.normalX + Math.sin(radians) * state.normalY;
      expect(Math.abs(intoWall)).toBeLessThan(0.15);
    }
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

  it("counts a rest on a surface as contact, not as a fresh impact every step", () => {
    const state = run(CORNER, 2).state;
    expect(state.contact).toBeGreaterThan(0.9);
    expect(state.impact).toBe(0);
    // The spring still pushes hard into the wall; the eye is what has arrived.
    expect(state.speed).toBeLessThan(1);
    expect(Math.hypot(state.x.velocity, state.y.velocity)).toBeGreaterThan(1);
  });

  it("comes back round after peeling off a surface", () => {
    const state = createEyeState();
    const { clock } = drive(state, CORNER, 2);
    drive(state, { x: 0, y: 0 }, 1.5, clock);

    expect(state.contact).toBe(0);
    expect(state.press).toBe(0);
    expect(stretchOf(state)).toBeLessThan(0.02);
  });

  it("keeps the pupil inside the eye through the hardest press it can reach", () => {
    const state = run({ x: 60, y: 60 }, 4).state;
    expect(Math.hypot(state.pupilX.position, state.pupilY.position)).toBeLessThanOrEqual(
      TILE.eye - TILE.pupil,
    );
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

  it("loses the same tangential speed per second at any step size", () => {
    const outside = TRAVEL_HALF + 1;
    let coarse = 10;
    let fine = 10;
    for (let step = 0; step < 60; step += 1) {
      coarse = resolveBoundary(outside, 0, 0, coarse, 1 / 60).vy;
    }
    for (let step = 0; step < 240; step += 1) {
      fine = resolveBoundary(outside, 0, 0, fine, 1 / 240).vy;
    }

    expect(coarse).toBeCloseTo(fine, 9);
    expect(coarse).toBeLessThan(10);
  });

  it("reports no contact and no impact while the eye is free", () => {
    const free = resolveBoundary(0, 0, 50, 50, STEP);
    expect(free.impact).toBe(0);
    expect(free.x).toBe(0);
    expect(free.vx).toBe(50);

    const leaving = resolveBoundary(TRAVEL_HALF + 1, 0, -50, 0, STEP);
    expect(leaving.impact).toBe(0);
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

    let firstFull = Infinity;
    let lastHalf = 0;
    for (let phase = 0; phase <= BLINK_CYCLE; phase += 0.001) {
      const closure = blinkClosure(phase);
      expect(closure).toBeGreaterThanOrEqual(0);
      expect(closure).toBeLessThanOrEqual(1);
      if (closure >= 0.999) firstFull = Math.min(firstFull, phase);
      if (closure >= 0.5) lastHalf = Math.max(lastHalf, phase);
    }

    expect(firstFull).toBeLessThan(0.08);
    expect(lastHalf).toBeGreaterThan(0.15);
  });

  it("gives an ordinary glance to the pupil and leaves the shell near its centre", () => {
    const glance = run(GLANCE, 2).state;
    const shell = Math.hypot(glance.x.position, glance.y.position);
    const pupil = Math.hypot(glance.pupilX.position, glance.pupilY.position);

    expect(pupil).toBeGreaterThan(shell);
    expect(shell).toBeLessThan(TRAVEL_HALF / 3);
    expect(pupil).toBeGreaterThan(3);

    // A look inside the deadzone is the pupil's alone.
    const inside = run(INSIDE, 2).state;
    expect(Math.hypot(inside.x.position, inside.y.position)).toBeLessThan(1);
    expect(Math.hypot(inside.pupilX.position, inside.pupilY.position)).toBeGreaterThan(2);
  });

  it("still drags the shell to the border for a look far past the deadzone", () => {
    const state = run(CORNER, 3).state;
    expect(Math.hypot(state.x.position, state.y.position)).toBeGreaterThan(TRAVEL_HALF);
    expect(state.press).toBeGreaterThan(0.8);
  });

  it("keeps the pupil moving even with nothing to look at", () => {
    const state = createEyeState();
    const { clock } = drive(state, { x: 0, y: 0 }, 2);

    let low = Infinity;
    let high = -Infinity;
    for (let step = 0; step < Math.round(1.5 / STEP); step += 1) {
      advanceEye(state, { x: 0, y: 0 }, STEP, clock + step * STEP);
      low = Math.min(low, state.pupilX.position);
      high = Math.max(high, state.pupilX.position);
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

describe("the mark's life in each state", () => {
  it("holds the centre while attending, so the state's pose is what moves it", () => {
    // The CSS pose layer and the simulation write different elements, and they
    // would read as one confused mark if both moved the eye across the tile.
    for (const intent of ATTENTIVE_GAZE_INTENTS) {
      const state = run(intent, 2).state;
      expect(Math.hypot(state.x.position, state.y.position)).toBeLessThan(1);
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
      low = Math.min(low, state.pupilX.position);
      high = Math.max(high, state.pupilX.position);
    }

    expect(Math.hypot(state.pupilX.position, state.pupilY.position)).toBeGreaterThan(1);
    expect(high - low).toBeGreaterThan(0.1);
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
    // 1/30 s steps would explode the stiff shell spring without subdivision.
    const state = createEyeState();
    let escaped = -Infinity;
    for (let frame = 0; frame < 60; frame += 1) {
      advanceEye(state, CORNER, 1 / 30, (frame + 1) / 30);
      escaped = Math.max(escaped, escapeOf(state));
    }

    expect(escaped).toBeLessThan(1e-6);
    expect(Number.isFinite(state.x.position)).toBe(true);
    expect(state.press).toBeGreaterThan(0.8);
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

    // Recovery means behaviour, not just finiteness: the eye still corners.
    drive(state, CORNER, 2);
    expect(state.press).toBeGreaterThan(0.8);
  });

  it("reads a non-finite intent as looking at the centre", () => {
    const state = run({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, 2).state;

    expect(Number.isFinite(state.x.position)).toBe(true);
    expect(Number.isFinite(state.pupilX.position)).toBe(true);
    expect(Math.hypot(state.x.position, state.y.position)).toBeLessThan(TRAVEL_HALF);
  });

  it("keeps the pupil behind the shell's rim however the state was arrived at", () => {
    const state = createEyeState();
    state.pupilX = { position: 40, velocity: 500 };
    advanceEye(state, { x: 60, y: 60 }, STEP, 1);

    expect(Math.hypot(state.pupilX.position, state.pupilY.position)).toBeLessThanOrEqual(
      TILE.eye - TILE.pupil + 1e-9,
    );
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
    // A radius past the half extent clamps to the largest circle that fits.
    expect(roundedRectDistance(0, 0, 30, 40)).toBeCloseTo(-30, 9);

    const [nx, ny] = boundaryNormal(35, 0, 30, 40);
    expect(Number.isFinite(nx)).toBe(true);
    expect(Number.isFinite(ny)).toBe(true);
    expect(Math.hypot(nx, ny)).toBeCloseTo(1, 9);
  });
});
