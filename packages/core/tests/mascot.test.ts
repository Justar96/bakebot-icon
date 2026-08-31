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

import { createMascot, type MascotPose } from "../src/mascot.js";
import { DEFAULT_SHAPE, facingAngles, facingEyes, MASCOT_GEOMETRY } from "../src/geometry.js";
import { ATTENTIVE_GAZE_INTENTS, createRandom, DEFAULT_GAZE_INTENTS } from "../src/gaze.js";
import {
  DEFAULT_TUNING,
  resolveTuning,
  SETTLED_TUNING,
  type MascotTuning,
} from "../src/tuning.js";

/** A frame at 60 Hz, which is two of the simulation's own steps. */
const FRAME = 1 / 60;

const FIELDS = [
  "x",
  "y",
  "angle",
  "stretch",
  "squash",
  "lid",
  "yaw",
  "pitch",
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
    // Drift and tremor are functions of the clock rather than of the random
    // stream, and every clock starts at zero. Without a per-mascot phase
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
    expect(resolveTuning({ deadzone: -1 }).deadzone).toBe(0);
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
          jellyFree: { frequency: dial(), damping: dial() },
          jellyContact: { frequency: dial(), damping: dial() },
          squish: dial(),
          restlessness: dial(),
          blinkInterval: dial(),
          blinkSpread: dial(),
          deadzone: dial(),
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
    expect(resolved.gaze.stiffness).toBeCloseTo(288, 6);
    expect(resolved.gaze.damping).toBeCloseTo(28, 6);
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

describe("the manifest does not carry the field that breaks its own build", () => {
  it("declares no sideEffects at all", async () => {
    // Bun applies a package's own `sideEffects` to its source while building
    // it, and a named-re-export entrypoint then prunes to a list of names with
    // nothing defining them — a successful build and a broken package
    // (oven-sh/bun#27709). `scripts/build.ts` catches the symptom; this catches
    // the cause, with the reason attached. The field bought this package
    // nothing: `dist` is one pre-bundled ESM module with no top-level side
    // effects, which Bun and Rollup shake identically either way.
    const manifest = (await Bun.file(
      new URL("../package.json", import.meta.url),
    ).json()) as Record<string, unknown>;
    expect("sideEffects" in manifest).toBe(false);
  });
});

describe("a mascot asked for less motion is quieter, not dead", () => {
  /** Largest eye excursion, largest deformation, and whether it blinked. */
  const survey = (mascot: ReturnType<typeof createMascot>, seconds: number) => {
    let travel = 0;
    let stretch = 1;
    let blinks = 0;
    let shut = false;
    for (let i = 0; i < seconds / FRAME; i += 1) {
      mascot.advance(FRAME);
      const pose = mascot.pose();
      travel = Math.max(travel, Math.hypot(pose.x, pose.y));
      stretch = Math.max(stretch, pose.stretch);
      if (pose.lid > 0.5 !== shut) {
        shut = pose.lid > 0.5;
        if (shut) blinks += 1;
      }
    }
    return { travel, stretch, blinks };
  };

  it("holds the eye near its centre and takes the deformation out", () => {
    // The claim `reducedMotion="settle"` rests on: still alive, but nothing
    // that crosses the tile or changes the eye's shape. Checked across seeds
    // because the gaze order is drawn from the stream, not fixed.
    for (const seed of [1, 7, 19, 41]) {
      const settled = survey(
        createMascot({ intents: ATTENTIVE_GAZE_INTENTS, seed, tuning: SETTLED_TUNING }),
        60,
      );
      expect(settled.travel).toBeLessThan(1);
      // `squish: 0` scales every deformation drive to nothing, so this is not
      // "small" — it is exactly round, every frame.
      expect(settled.stretch).toBe(1);
      expect(settled.blinks).toBeGreaterThan(0);
    }
  });

  it("is the quiet one only by comparison with a wandering Idle", () => {
    // A bound means nothing without the thing it is a bound on: the same
    // survey against the gaze a reader would otherwise get.
    for (const seed of [1, 7, 19, 41]) {
      const wandering = survey(createMascot({ intents: DEFAULT_GAZE_INTENTS, seed }), 60);
      expect(wandering.travel).toBeGreaterThan(10);
      expect(wandering.stretch).toBeGreaterThan(1);
    }
  });

  it("keeps an attending pair alive without turning it into a wander", () => {
    // The pair has no pupil to spend a short glance on, so the eyes themselves
    // answer it. The amplitude stays small enough that the state's pose still
    // carries the read, but large enough not to look frozen.
    for (const seed of [1, 7, 19, 41]) {
      const attending = survey(createMascot({ intents: ATTENTIVE_GAZE_INTENTS, seed }), 30);
      expect(attending.travel).toBeGreaterThan(1.5);
      expect(attending.travel).toBeLessThan(4);
      expect(attending.stretch).toBeLessThan(1.02);
      expect(attending.blinks).toBeGreaterThan(0);
    }
  });

  it("faces where it is looking, and the pair turns with it", () => {
    // The read the whole redesign is for: an eye out at the border is not a
    // ball resting against a wall, it is a face turned that way. So the turn
    // has to track the eye every frame rather than being a state of its own.
    const mascot = createMascot({ intents: [{ x: -60, y: 0, hold: 10 }], seed: 3 });
    const poses = stream(mascot, 180);

    for (const pose of poses) {
      expect(Math.sign(pose.yaw)).toBe(Math.sign(pose.x));
      expect(facingAngles(pose.x, pose.y)[0]).toBeCloseTo(pose.yaw, 12);
    }

    const held = poses[poses.length - 1]!;
    expect(held.x).toBeLessThan(-DEFAULT_SHAPE.travelHalfX + 0.5);
    expect(held.yaw).toBeCloseTo(facingAngles(-DEFAULT_SHAPE.travelHalfX, 0)[0], 1);

    // And the face reads as turned rather than slid: the leading disc — the
    // left one, for a look to the left — has swung toward the silhouette and
    // narrowed, while the trailing one has come round toward the middle.
    const [left, right] = facingEyes(held.yaw, held.pitch);
    const [restLeft, restRight] = facingEyes(0, 0);
    expect(left.scaleX).toBeLessThan(0.75);
    // Narrowed, but still an eye: a full turn bottoms out on the floor rather
    // than projecting the leading disc away to nothing.
    expect(left.scaleX).toBeCloseTo(MASCOT_GEOMETRY.eyes.minimumScaleX, 5);
    expect(right.scaleX).toBeGreaterThan(0.9);
    expect(right.x - left.x).toBeLessThan(restRight.x - restLeft.x);

    // Straight ahead is straight ahead: a mascot looking at its own centre is
    // not holding a turn it has to be talked out of.
    const centred = stream(createMascot({ intents: [{ x: 0, y: 0, hold: 10 }], seed: 3 }), 180);
    expect(Math.abs(centred[centred.length - 1]!.yaw)).toBeLessThan(1);
  });
});
