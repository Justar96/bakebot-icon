import { describe, expect, it } from "bun:test";

/**
 * The properties the mascot keeps as a character rather than as physics.
 *
 * `simulation.test.ts` protects what the springs and the geometry do. This
 * protects the layer above them: that a run is reproducible from its seed, that
 * two mascots on a page are not one mascot, that changing where the eye looks
 * does not rebuild the world, and that no tuning a caller can express can put a
 * non-finite value on screen.
 */

import { createMascot, type MascotPose } from "../src/mascot";
import { ATTENTIVE_GAZE_INTENTS, createRandom, DEFAULT_GAZE_INTENTS } from "../src/gaze";
import { DEFAULT_TUNING, resolveTuning, type MascotTuning } from "../src/tuning";

/** A frame at 60 Hz, which is two of the simulation's own steps. */
const FRAME = 1 / 60;

const FIELDS = [
  "x",
  "y",
  "pupilX",
  "pupilY",
  "angle",
  "stretch",
  "squash",
  "lid",
  "dilation",
] as const satisfies readonly (keyof MascotPose)[];

/** Advance a mascot at a steady frame rate and collect what it looked like. */
function stream(mascot: ReturnType<typeof createMascot>, frames: number): MascotPose[] {
  const poses: MascotPose[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    mascot.advance(FRAME);
    poses.push(mascot.pose());
  }
  return poses;
}

const differenceBetween = (a: readonly MascotPose[], b: readonly MascotPose[]): number => {
  let worst = 0;
  for (let index = 0; index < a.length; index += 1) {
    for (const field of FIELDS) {
      worst = Math.max(worst, Math.abs(a[index]![field] - b[index]![field]));
    }
  }
  return worst;
};

const allFinite = (poses: readonly MascotPose[]): boolean =>
  poses.every((pose) => FIELDS.every((field) => Number.isFinite(pose[field])));

describe("a mascot's run is reproducible from its seed", () => {
  it("replays identically for the same seed and the same frame cadence", () => {
    const first = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 12345 }), 900);
    const second = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 12345 }), 900);

    // Bit-identical, not merely close: the whole point of a seeded stream is
    // that a visual test can pin a frame.
    expect(differenceBetween(first, second)).toBe(0);
  });

  it("diverges for a different seed", () => {
    const first = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 1 }), 900);
    const second = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 2 }), 900);

    expect(differenceBetween(first, second)).toBeGreaterThan(1);
  });
});

describe("two mascots on a page are not one mascot", () => {
  it("gives each its own seed when none is asked for", () => {
    const first = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS }), 600);
    const second = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS }), 600);

    expect(differenceBetween(first, second)).toBeGreaterThan(1);
  });

  it("desynchronises the drift, which no seed alone would do", () => {
    // Drift, tremor and dilation are functions of the clock rather than of the
    // random stream, and every clock starts at zero. Without a per-mascot phase
    // offset these would march in step no matter what the seeds were, so the
    // very first frames — long before any gaze choice has been made — are what
    // this checks.
    const first = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 7 }), 12);
    const second = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 8 }), 12);

    expect(differenceBetween(first, second)).toBeGreaterThan(0);
  });
});

describe("changing where the eye looks does not rebuild the world", () => {
  it("carries the eye's position across a change of gaze", () => {
    const mascot = createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 99 });
    // Long enough that the eye has been dragged well away from the centre.
    let departed = mascot.pose();
    for (let frame = 0; frame < 3000; frame += 1) {
      mascot.advance(FRAME);
      const pose = mascot.pose();
      if (Math.hypot(pose.x, pose.y) > Math.hypot(departed.x, departed.y)) departed = pose;
    }
    expect(Math.hypot(departed.x, departed.y)).toBeGreaterThan(3);

    const before = mascot.pose();
    mascot.setIntents(ATTENTIVE_GAZE_INTENTS);
    const after = mascot.pose();

    // The same frame, read either side of the swap: nothing has been reset, so
    // the pose is untouched until the simulation is advanced again.
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.lid).toBe(before.lid);

    // And it keeps moving from there rather than springing back to the centre.
    mascot.advance(FRAME);
    const next = mascot.pose();
    expect(Math.hypot(next.x - before.x, next.y - before.y)).toBeLessThan(2);
  });

  it("stops simulating when the gaze is taken away and resumes where it left off", () => {
    const mascot = createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 4 });
    stream(mascot, 600);
    const alive = mascot.pose();

    mascot.setIntents(null);
    expect(mascot.alive).toBe(false);
    stream(mascot, 600);
    expect(mascot.pose().x).toBe(alive.x);

    mascot.setIntents(DEFAULT_GAZE_INTENTS);
    expect(mascot.alive).toBe(true);
    mascot.advance(FRAME);
    expect(mascot.pose().x).not.toBe(alive.x);
  });
});

describe("no tuning a caller can express destabilises the simulation", () => {
  it("clamps the springs into a region the integrator is stable in", () => {
    // Frequency decides stability: semi-implicit Euler holds while the angular
    // frequency times the step stays well under 2, and the step is 1/240 s.
    const fastest = resolveTuning({ gaze: { frequency: 1e9, damping: 1e9 } });
    const angular = Math.sqrt(fastest.gaze.stiffness);
    expect(angular / 240).toBeLessThan(0.5);

    const slowest = resolveTuning({ gaze: { frequency: -1e9, damping: -1e9 } });
    expect(slowest.gaze.stiffness).toBeGreaterThan(0);
    expect(slowest.gaze.damping).toBeGreaterThan(0);
  });

  it("falls back rather than passing a non-finite dial to a spring", () => {
    const resolved = resolveTuning({
      gaze: { frequency: Number.NaN, damping: Number.POSITIVE_INFINITY },
      squish: Number.NaN,
      restlessness: Number.NEGATIVE_INFINITY,
      blinkInterval: Number.NaN,
    } as Partial<MascotTuning>);

    for (const value of Object.values(resolved)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
      else {
        expect(Number.isFinite(value.stiffness)).toBe(true);
        expect(Number.isFinite(value.damping)).toBe(true);
      }
    }
    // A non-finite dial has no nearest legal value, so it takes the default
    // rather than being clamped to an end of the range.
    expect(resolved.squish).toBe(DEFAULT_TUNING.squish);
    expect(resolved.restlessness).toBe(DEFAULT_TUNING.restlessness);
  });

  it("clamps a finite dial that is merely out of range", () => {
    // Unlike a non-finite one, an extreme but real number does have a nearest
    // legal value, and taking it is what lets a slider run to its end.
    expect(resolveTuning({ restlessness: -5 }).restlessness).toBe(0);
    expect(resolveTuning({ squish: 500 }).squish).toBe(3);
    expect(resolveTuning({ shellDeadzone: -1 }).shellDeadzone).toBe(0);
  });

  it("survives garbage from a plain-JavaScript caller", () => {
    // Not TypeScript-shaped at all: the surface is public, so it also serves
    // data loaded from a file and callers no compiler has checked.
    for (const rubbish of [
      null,
      undefined,
      42,
      "loose",
      [],
      { gaze: "fast" },
      { gaze: { frequency: "3" } },
      { squish: {} },
      { blinkInterval: [] },
    ]) {
      const mascot = createMascot({
        intents: DEFAULT_GAZE_INTENTS,
        seed: 3,
        tuning: rubbish as Partial<MascotTuning>,
      });
      expect(allFinite(stream(mascot, 240))).toBe(true);
    }
  });

  it("stays finite over a long run at randomly chosen extreme tuning", () => {
    const random = createRandom(0xc0ffee);
    for (let trial = 0; trial < 24; trial += 1) {
      const dial = () => (random() < 0.5 ? -1 : 1) * 10 ** (random() * 8);
      const mascot = createMascot({
        intents: DEFAULT_GAZE_INTENTS,
        seed: trial,
        tuning: {
          gaze: { frequency: dial(), damping: dial() },
          pupil: { frequency: dial(), damping: dial() },
          jellyFree: { frequency: dial(), damping: dial() },
          jellyContact: { frequency: dial(), damping: dial() },
          squish: dial(),
          restlessness: dial(),
          blinkInterval: dial(),
          blinkSpread: dial(),
          shellDeadzone: dial(),
        },
      });
      // Sixty simulated seconds is far past where an unstable spring would
      // already have written Infinity into every field.
      expect(allFinite(stream(mascot, 60 * 60))).toBe(true);
    }
  });

  it("retunes mid-run without resetting the eye", () => {
    const mascot = createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 21 });
    stream(mascot, 900);
    const before = mascot.pose();

    mascot.setTuning({ squish: 0, restlessness: 0 });
    expect(mascot.pose().x).toBe(before.x);
    expect(allFinite(stream(mascot, 900))).toBe(true);
  });
});

describe("the default tuning is the tuning the mascot was built at", () => {
  it("round-trips the tuned springs through frequency and damping ratio", () => {
    const resolved = resolveTuning();
    // The dials are a caller-facing reparametrisation of these numbers, so
    // supplying no tuning has to reproduce them and not merely approach them.
    expect(resolved.gaze.stiffness).toBeCloseTo(420, 6);
    expect(resolved.gaze.damping).toBeCloseTo(34, 6);
    expect(resolved.pupil.stiffness).toBeCloseTo(150, 6);
    expect(resolved.pupil.damping).toBeCloseTo(16, 6);
    expect(resolved.jellyFree.stiffness).toBeCloseTo(165, 6);
    expect(resolved.jellyFree.damping).toBeCloseTo(11, 6);
    expect(resolved.jellyContact.stiffness).toBeCloseTo(165, 6);
    expect(resolved.jellyContact.damping).toBeCloseTo(26, 6);
  });

  it("moves like the mascot did before the dials existed", () => {
    const tuned = stream(createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 5 }), 600);
    const explicit = stream(
      createMascot({ intents: DEFAULT_GAZE_INTENTS, seed: 5, tuning: DEFAULT_TUNING }),
      600,
    );
    expect(differenceBetween(tuned, explicit)).toBe(0);
  });
});
