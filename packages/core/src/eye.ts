/**
 * What the eye does. Everything here is pure and DOM-free; `useEyeMotion`
 * owns the clock and the writes.
 *
 * The eyes are one mass on a stiff spring, confined to the travel region in
 * `geometry.ts`, carrying a second under-damped spring that deforms them.
 * Nothing is keyframed: the stretch along a saccade and the wobble as it
 * settles are consequences of those two springs.
 *
 * The boundary is a limit, not a wall. Nothing rebounds off it and nothing
 * splats against it, because reaching it does not mean the eye hit something —
 * it means the face has turned as far that way as it turns. See `contain` and
 * `MascotPose.yaw`.
 */

import { contain, DEFAULT_SHAPE, smoothstep, travelDistance, type TileShape } from "./geometry";
import { restingSpring, stepSpring, type SpringConfig, type SpringValue } from "./spring";
import { DEFAULT_RESOLVED, type ResolvedTuning } from "./tuning";

/* Springs. Both are under-damped on purpose and the damping ratio is what
 * separates them. The gaze is nearly critical, so a saccade lands with one
 * small glissade. The jelly is loose enough to ring, which is where the wobble
 * after a saccade comes from — it is not an animation, it is the spring
 * returning to rest.
 *
 * The numbers themselves are `tuning.ts`, which is also where a caller may
 * move them. They arrive here already clamped into a stable region, so this
 * module never has to ask whether a spring it was handed is integrable.
 *
 * Free in the air the jelly rings; at the end of its travel it is viscous and
 * settles. Interpolating between the two by how near the border the eye is is
 * what keeps a held look from ringing on for as long as it is held. */

/* Deformation. The jelly vector's direction is the stretch axis and its length
 * is the amount; the perpendicular axis takes the reciprocal, so area is
 * preserved and the mascot never gains visual weight. */
const VELOCITY_STRETCH = 0.0019;
export const MAX_STRETCH = 0.42;

/* How near the boundary counts as holding a turn. It buys nothing kinetic —
 * it is the blend between the two jelly springs, so a look being held settles
 * viscously instead of ringing on at the end of its travel. */
const CONTACT_BAND = 0.9;

/* Lids. Closing is faster than opening, which is what makes a blink read as a
 * blink rather than as a fade, and each half has the curve its own stroke has:
 * the downstroke accelerates into the close, the upstroke decelerates out of
 * it. The gap at the end is the spacing of a double blink. */
const BLINK_CLOSE = 0.075;
const BLINK_HOLD = 0.02;
const BLINK_OPEN = 0.14;
const BLINK_GAP = 0.09;
export const BLINK_CYCLE = BLINK_CLOSE + BLINK_HOLD + BLINK_OPEN + BLINK_GAP;

/**
 * The stretch axis and the two scale factors it implies. Area is preserved.
 *
 * The jelly is held in double-angle space: an axis at θ is stored at 2θ, so
 * the two ends of one axis are the same point and there is no sign to flip.
 * A velocity and its reverse stretch the eye the same way, and a signed axis
 * would flip on the noise of a drifting eye — driving the spring with a square
 * wave at its own frequency instead of pressing it. It also makes an overshoot
 * correct: passing through zero turns a squash into a stretch on the same
 * axis, which is a quarter turn here rather than a meaningless half turn.
 */
export function deformation(jellyX: number, jellyY: number) {
  // A soft ceiling rather than a hard one: a fluid stiffens as it thins, and a
  // clipped magnitude reads as a shape stuck at its limit.
  const raw = Math.hypot(jellyX, jellyY);
  const magnitude = MAX_STRETCH * Math.tanh(raw / MAX_STRETCH);
  const stretch = 1 + magnitude;
  return {
    angle: magnitude > 1e-4 ? (Math.atan2(jellyY, jellyX) * 90) / Math.PI : 0,
    stretch,
    squash: 1 / stretch,
  };
}

/** How shut the lid is, 0 to 1, at a given phase of one blink cycle. */
export function blinkClosure(phase: number): number {
  if (phase < 0 || phase >= BLINK_CYCLE) return 0;
  if (phase < BLINK_CLOSE) {
    const t = phase / BLINK_CLOSE;
    return t * t;
  }
  if (phase < BLINK_CLOSE + BLINK_HOLD) return 1;
  // The upstroke decelerates rather than easing in and out. A lid does not
  // hesitate at the bottom before it comes back up: it leaves at once and
  // creeps the last of the way open, which is where the unhurried tail of a
  // blink comes from. A symmetric ease reads as the eye being held shut.
  const t = (phase - BLINK_CLOSE - BLINK_HOLD) / BLINK_OPEN;
  if (t >= 1) return 0;
  return (1 - t) * (1 - t);
}

export interface EyeState {
  x: SpringValue;
  y: SpringValue;
  /** Direction is the stretch axis, length is the amount. */
  jellyX: SpringValue;
  jellyY: SpringValue;
  /** How near the boundary the eye is, 0 to 1: how fully the face has turned. */
  contact: number;
  /**
   * How fast the eye is actually travelling, which is not the speed its spring
   * wants: at the end of its travel the spring pushes on and the boundary takes
   * that push back. Arrival is judged on this.
   */
  speed: number;
  blinkPhase: number;
  blinkQueue: number;
  blinkStrength: number;
}

export function createEyeState(): EyeState {
  return {
    x: restingSpring(),
    y: restingSpring(),
    jellyX: restingSpring(),
    jellyY: restingSpring(),
    contact: 0,
    speed: 0,
    blinkPhase: BLINK_CYCLE,
    blinkQueue: 0,
    blinkStrength: 1,
  };
}

/** Queue a blink of a given strength; 1 is a full one, less is a squint. */
export function queueBlink(state: EyeState, count: number, strength: number): void {
  state.blinkQueue = count;
  state.blinkStrength = strength;
}

export function isBlinking(state: EyeState): boolean {
  return state.blinkQueue > 0 || state.blinkPhase < BLINK_CYCLE;
}

/* The largest step the springs integrate safely. The simulation drives itself
 * at a fixed 1/240 s; anything coarser from an outside caller is subdivided
 * rather than allowed to destabilise the stiff gaze spring. */
const MAX_INTEGRATION_STEP = 1 / 120;

/* A spring holding NaN or Infinity never recovers on its own — every force
 * computed from it is NaN too — so a poisoned value is reset to rest. */
const healSpring = (spring: SpringValue): SpringValue =>
  Number.isFinite(spring.position) && Number.isFinite(spring.velocity)
    ? spring
    : restingSpring();

/**
 * One simulation step. Drift, saccade, containment, deformation and lids are
 * integrated together, so a blink can happen during a glance and a turn can
 * hold through a blink.
 *
 * The step is subdivided past `MAX_INTEGRATION_STEP` (the clock each substep
 * sees still ends where the caller's clock ends), and a degenerate or
 * non-finite step is refused outright — a zero step would otherwise divide
 * the arrival speed by zero and stall the gaze dwell forever.
 */
export function advanceEye(
  state: EyeState,
  intent: { x: number; y: number },
  seconds: number,
  clock: number,
  tuning: ResolvedTuning = DEFAULT_RESOLVED,
  shape: TileShape = DEFAULT_SHAPE,
): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const steps = Math.ceil(seconds / MAX_INTEGRATION_STEP);
  const step = seconds / steps;
  for (let i = 0; i < steps; i += 1) {
    integrateEye(state, intent, step, clock - seconds + step * (i + 1), tuning, shape);
  }
}

function integrateEye(
  state: EyeState,
  intent: { x: number; y: number },
  seconds: number,
  clock: number,
  tuning: ResolvedTuning,
  shape: TileShape,
): void {
  // Heal before integrating: one poisoned value would otherwise spread through
  // every spring in a single step.
  state.x = healSpring(state.x);
  state.y = healSpring(state.y);
  state.jellyX = healSpring(state.jellyX);
  state.jellyY = healSpring(state.jellyY);
  if (!Number.isFinite(state.blinkPhase)) state.blinkPhase = BLINK_CYCLE;
  if (!Number.isFinite(state.blinkQueue)) state.blinkQueue = 0;
  if (!Number.isFinite(state.blinkStrength)) state.blinkStrength = 1;

  // A non-finite intent or clock reads as noise, not as a place to look.
  const time = Number.isFinite(clock) ? clock : 0;
  const lookIntentX = Number.isFinite(intent.x) ? intent.x : 0;
  const lookIntentY = Number.isFinite(intent.y) ? intent.y : 0;

  const fromX = state.x.position;
  const fromY = state.y.position;

  // An eye is never still. Two slow incommensurate waves stand in for ocular
  // drift and one fast small wave for tremor; without them a settled eye reads
  // as a frozen image rather than as a live one.
  const restlessness = tuning.restlessness;
  const driftX =
    (Math.sin(time * 0.83) * 0.3 +
      Math.sin(time * 1.97 + 1.1) * 0.16 +
      Math.sin(time * 11.3) * 0.045) *
    restlessness;
  const driftY =
    (Math.cos(time * 0.71 + 0.4) * 0.28 +
      Math.cos(time * 2.31 + 2.2) * 0.14 +
      Math.cos(time * 12.7) * 0.045) *
    restlessness;
  // The eyes take only what is left of the intent past the deadzone, so the
  // shortest looks do not move them at all and the mascot keeps its centre.
  // Drift is added after the deadzone rather than through it: eyes at rest
  // should still breathe, not stop dead.
  const intentLength = Math.hypot(lookIntentX, lookIntentY);
  const share =
    intentLength > 1e-6 ? Math.max(intentLength - tuning.deadzone, 0) / intentLength : 0;
  const aimX = lookIntentX * share + driftX;
  const aimY = lookIntentY * share + driftY;

  // Past the travel region an intent says direction, not force. Springing at
  // the raw off-tile coordinate made a farther coordinate hit the same turn
  // harder and sooner, even though both wishes resolve to the same face pose.
  // Project the rest onto the region first, so a full turn arrives through the
  // gaze spring instead of ending in an artificial high-speed stop.
  const rest = contain(aimX, aimY, 0, 0, shape);
  state.x = stepSpring(state.x, rest.x, seconds, tuning.gaze);
  state.y = stepSpring(state.y, rest.y, seconds, tuning.gaze);

  const bounded = contain(
    state.x.position,
    state.y.position,
    state.x.velocity,
    state.y.velocity,
    shape,
  );
  state.x.position = bounded.x;
  state.x.velocity = bounded.vx;
  state.y.position = bounded.y;
  state.y.velocity = bounded.vy;
  state.speed = Math.hypot(state.x.position - fromX, state.y.position - fromY) / seconds;

  const distance = travelDistance(state.x.position, state.y.position, shape);
  state.contact = smoothstep(-CONTACT_BAND, 0, distance);

  // The one deformation drive left: a moving eye stretches along its own
  // velocity. It is an axis rather than a direction, held in double-angle
  // space where a half turn is the identity — see `deformation`.
  const speed = Math.hypot(state.x.velocity, state.y.velocity);
  const squish = tuning.squish;
  const flight = speed > 1e-6 ? (VELOCITY_STRETCH * squish) / speed : 0;

  const free = tuning.jellyFree;
  const held = tuning.jellyContact;
  const jelly: SpringConfig = {
    stiffness: free.stiffness + (held.stiffness - free.stiffness) * state.contact,
    damping: free.damping + (held.damping - free.damping) * state.contact,
  };
  state.jellyX = stepSpring(
    state.jellyX,
    flight * (state.x.velocity * state.x.velocity - state.y.velocity * state.y.velocity),
    seconds,
    jelly,
  );
  state.jellyY = stepSpring(
    state.jellyY,
    flight * 2 * state.x.velocity * state.y.velocity,
    seconds,
    jelly,
  );

  if (state.blinkQueue > 0 && state.blinkPhase >= BLINK_CYCLE) {
    state.blinkPhase = 0;
    state.blinkQueue -= 1;
  } else if (state.blinkPhase < BLINK_CYCLE) {
    state.blinkPhase += seconds;
  }
}
