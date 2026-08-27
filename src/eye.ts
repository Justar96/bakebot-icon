/**
 * What the eye does. Everything here is pure and DOM-free; `useIdleMotion`
 * owns the clock and the writes.
 *
 * The eye is one mass on a stiff spring, confined to the travel region in
 * `geometry.ts`, carrying a second under-damped spring that deforms it.
 * Nothing is keyframed: the stretch along a saccade, the splat against a wall,
 * the pooling into a corner and the wobble afterwards are all consequences of
 * those two springs meeting the boundary.
 */

import { LOOK_REACH } from "./gaze";
import {
  clamp,
  resolveBoundary,
  smoothstep,
  TILE,
  travelDistance,
  travelNormal,
} from "./geometry";
import { restingSpring, stepSpring, type SpringConfig, type SpringValue } from "./spring";

/* Springs. Each is under-damped on purpose and the damping ratio is what
 * separates them. The shell is nearly critical, so a saccade lands with one
 * small glissade. The pupil is loose, so the interior lags the shell. The
 * jelly is loose enough to ring, which is where the wobble after an impact
 * comes from — it is not an animation, it is the spring returning to rest. */
const GAZE_SPRING: SpringConfig = { stiffness: 420, damping: 34 };
const PUPIL_SPRING: SpringConfig = { stiffness: 150, damping: 16 };
/* Free in the air the jelly rings; in contact it is viscous and settles into
 * the shape of what it is pressed against. Interpolating the damping by how
 * much of the eye is touching is what separates a bouncing ball from a drop. */
const JELLY_FREE: SpringConfig = { stiffness: 165, damping: 11 };
const JELLY_CONTACT: SpringConfig = { stiffness: 165, damping: 26 };

/* Deformation. The jelly vector's direction is the stretch axis and its length
 * is the amount; the perpendicular axis takes the reciprocal, so area is
 * preserved and the mark never gains visual weight. */
const VELOCITY_STRETCH = 0.0019;
const PRESS_SPREAD = 0.26;
const IMPACT_GAIN = 0.03;
const IMPACT_FLOOR = 6;
const CORNER_BOOST = 1.6;
/** Peeling off a surface snaps the shape back round, and past round. */
const RELEASE_SNAP = 1.1;
export const MAX_STRETCH = 0.42;

/* Contact. `contact` is how near the surface the eye is; `press` is how far
 * past the wall it still wants to go. Their product is the sustained force
 * that pools the eye into a corner and holds it there. */
const CONTACT_BAND = 0.9;
const PRESS_REACH = 7;

/* Looking is shared between the two circles, and not evenly. The pupil does
 * every glance and reaches the edge of its own range at LOOK_REACH; the shell
 * ignores anything shorter than its deadzone and only follows what is left, so
 * the mark rests near the centre and the life is in the pupil. Only a look far
 * past the deadzone drags the shell out to the border. */
const SHELL_DEADZONE = 9;
const PUPIL_RANGE = 6.2;
/** While pressed, the pupil piles toward the contact point. */
const PUPIL_POOL = 1;
const PUPIL_LIMIT = TILE.eye - TILE.pupil - 1;

/* Lids. Closing is faster than opening, which is what makes a blink read as a
 * blink rather than as a fade. The gap at the end is the spacing of a double
 * blink. */
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
 * That matters at a corner, where the eye's desire is parallel to the contact
 * normal and any signed tangent would flip on noise — driving the spring with
 * a square wave at its own frequency instead of pressing it. It also makes an
 * overshoot correct: passing through zero turns a squash into a stretch on the
 * same axis, which is a quarter turn here rather than a meaningless half turn.
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
  const t = (phase - BLINK_CLOSE - BLINK_HOLD) / BLINK_OPEN;
  if (t >= 1) return 0;
  return 1 - t * t * (3 - 2 * t);
}

export interface EyeState {
  x: SpringValue;
  y: SpringValue;
  pupilX: SpringValue;
  pupilY: SpringValue;
  /** Direction is the stretch axis, length is the amount. */
  jellyX: SpringValue;
  jellyY: SpringValue;
  normalX: number;
  normalY: number;
  /** How near the boundary the eye is, 0 to 1. */
  contact: number;
  /** Sustained force into the boundary, 0 to 1. */
  press: number;
  /** 1 for a corner contact, 0 for a flat wall. */
  cornerness: number;
  /**
   * Closing speed of a fresh strike, 0 otherwise. A body resting on a surface
   * is not being hit by it, so this stays 0 through a sustained press.
   */
  impact: number;
  /**
   * How fast the eye is actually travelling, which is not the speed its spring
   * wants: against a wall the spring pushes hard every step and the wall takes
   * all of it back. Arrival is judged on this.
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
    pupilX: restingSpring(),
    pupilY: restingSpring(),
    jellyX: restingSpring(),
    jellyY: restingSpring(),
    normalX: 0,
    normalY: 0,
    contact: 0,
    press: 0,
    cornerness: 0,
    impact: 0,
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
 * rather than allowed to destabilise the stiff shell spring. */
const MAX_INTEGRATION_STEP = 1 / 120;

/* A spring holding NaN or Infinity never recovers on its own — every force
 * computed from it is NaN too — so a poisoned value is reset to rest. */
const healSpring = (spring: SpringValue): SpringValue =>
  Number.isFinite(spring.position) && Number.isFinite(spring.velocity)
    ? spring
    : restingSpring();

/**
 * One simulation step. Drift, saccade, collision, deformation, pupil lag and
 * lids are integrated together, so a blink can happen during a glance and a
 * corner splat can happen during a blink.
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
): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const steps = Math.ceil(seconds / MAX_INTEGRATION_STEP);
  const step = seconds / steps;
  for (let i = 0; i < steps; i += 1) {
    integrateEye(state, intent, step, clock - seconds + step * (i + 1));
  }
}

function integrateEye(
  state: EyeState,
  intent: { x: number; y: number },
  seconds: number,
  clock: number,
): void {
  // Heal before integrating: one poisoned value would otherwise spread through
  // every spring in a single step.
  state.x = healSpring(state.x);
  state.y = healSpring(state.y);
  state.pupilX = healSpring(state.pupilX);
  state.pupilY = healSpring(state.pupilY);
  state.jellyX = healSpring(state.jellyX);
  state.jellyY = healSpring(state.jellyY);
  if (!Number.isFinite(state.blinkPhase)) state.blinkPhase = BLINK_CYCLE;
  if (!Number.isFinite(state.blinkQueue)) state.blinkQueue = 0;
  if (!Number.isFinite(state.blinkStrength)) state.blinkStrength = 1;

  // A non-finite intent or clock reads as noise, not as a place to look.
  const time = Number.isFinite(clock) ? clock : 0;
  const lookIntentX = Number.isFinite(intent.x) ? intent.x : 0;
  const lookIntentY = Number.isFinite(intent.y) ? intent.y : 0;

  const wasFree = state.contact < 0.5;
  const wasPressed = state.press;
  const fromX = state.x.position;
  const fromY = state.y.position;

  // An eye is never still. Two slow incommensurate waves stand in for ocular
  // drift and one fast small wave for tremor; without them a settled eye reads
  // as a frozen image rather than as a live one.
  const driftX =
    Math.sin(time * 0.83) * 0.3 +
    Math.sin(time * 1.97 + 1.1) * 0.16 +
    Math.sin(time * 11.3) * 0.045;
  const driftY =
    Math.cos(time * 0.71 + 0.4) * 0.28 +
    Math.cos(time * 2.31 + 2.2) * 0.14 +
    Math.cos(time * 12.7) * 0.045;
  const lookX = lookIntentX + driftX;
  const lookY = lookIntentY + driftY;
  const lookLength = Math.hypot(lookX, lookY);

  // The shell takes only what is left of the intent past its deadzone, so a
  // short glance moves the pupil alone and the mark keeps its centre. Drift is
  // added after the deadzone rather than through it: a resting shell should
  // still breathe, not stop dead.
  const intentLength = Math.hypot(lookIntentX, lookIntentY);
  const shellShare =
    intentLength > 1e-6 ? Math.max(intentLength - SHELL_DEADZONE, 0) / intentLength : 0;
  const aimX = lookIntentX * shellShare + driftX;
  const aimY = lookIntentY * shellShare + driftY;

  state.x = stepSpring(state.x, aimX, seconds, GAZE_SPRING);
  state.y = stepSpring(state.y, aimY, seconds, GAZE_SPRING);

  const contact = resolveBoundary(
    state.x.position,
    state.y.position,
    state.x.velocity,
    state.y.velocity,
    seconds,
  );
  state.x.position = contact.x;
  state.x.velocity = contact.vx;
  state.y.position = contact.y;
  state.y.velocity = contact.vy;
  // An impulse belongs to the moment of collision. Reporting one every step of
  // a rest would pump the deformation and re-fire the flinch forever.
  state.impact = wasFree ? contact.impact : 0;
  state.speed = Math.hypot(state.x.position - fromX, state.y.position - fromY) / seconds;

  const distance = travelDistance(state.x.position, state.y.position);
  state.contact = smoothstep(-CONTACT_BAND, 0, distance);
  if (state.contact > 0) {
    const [nx, ny] = travelNormal(state.x.position, state.y.position);
    state.normalX = nx;
    state.normalY = ny;
  }
  // Equal components mean a 45 degree contact, so this is 1 in a corner and 0
  // against a flat wall.
  state.cornerness = 2 * Math.abs(state.normalX * state.normalY);

  const reach = travelDistance(aimX, aimY);
  state.press = state.contact * clamp(reach / PRESS_REACH, 0, 1);

  // Stretching along the wall is compression into it. Both drives are axes
  // rather than directions, and they are summed in double-angle space where a
  // half turn is the identity — see `deformation`.
  const speed = Math.hypot(state.x.velocity, state.y.velocity);
  const flight = speed > 1e-6 ? VELOCITY_STRETCH / speed : 0;
  const spread = state.press * PRESS_SPREAD;
  const wallX = state.normalX * state.normalX - state.normalY * state.normalY;
  const wallY = 2 * state.normalX * state.normalY;

  const jelly: SpringConfig = {
    stiffness: JELLY_FREE.stiffness,
    damping: JELLY_FREE.damping + (JELLY_CONTACT.damping - JELLY_FREE.damping) * state.contact,
  };
  state.jellyX = stepSpring(
    state.jellyX,
    flight * (state.x.velocity * state.x.velocity - state.y.velocity * state.y.velocity) -
      spread * wallX,
    seconds,
    jelly,
  );
  state.jellyY = stepSpring(
    state.jellyY,
    flight * 2 * state.x.velocity * state.y.velocity - spread * wallY,
    seconds,
    jelly,
  );

  // An impact adds energy rather than moving the rest pose, so the splat and
  // the ringing that follows it are one spring rather than two animations.
  if (state.impact > IMPACT_FLOOR) {
    const gain = IMPACT_GAIN * state.impact * (1 + CORNER_BOOST * state.cornerness);
    state.jellyX.velocity -= wallX * gain;
    state.jellyY.velocity -= wallY * gain;
  }
  // Letting go of a surface is its own event: the shape springs back round and
  // overshoots onto the other axis, the way a drop releases.
  if (!wasFree && state.contact < 0.5 && wasPressed > 0.2) {
    state.jellyX.velocity += wallX * wasPressed * RELEASE_SNAP;
    state.jellyY.velocity += wallY * wasPressed * RELEASE_SNAP;
  }

  // The pupil does the whole glance, scaled into its own range, plus a tremor
  // of its own so it is alive even when the shell has nothing to do.
  const aimShare = lookLength > 1e-6 ? Math.min(lookLength / LOOK_REACH, 1) / lookLength : 0;
  let pupilTargetX =
    lookX * aimShare * PUPIL_RANGE +
    state.normalX * state.press * PUPIL_POOL +
    Math.sin(time * 1.61 + 0.7) * 0.22 +
    Math.sin(time * 3.7 + 2.3) * 0.1;
  let pupilTargetY =
    lookY * aimShare * PUPIL_RANGE +
    state.normalY * state.press * PUPIL_POOL +
    Math.cos(time * 1.43 + 1.9) * 0.2 +
    Math.cos(time * 4.1 + 0.5) * 0.09;
  const reachLength = Math.hypot(pupilTargetX, pupilTargetY);
  if (reachLength > PUPIL_LIMIT) {
    pupilTargetX = (pupilTargetX / reachLength) * PUPIL_LIMIT;
    pupilTargetY = (pupilTargetY / reachLength) * PUPIL_LIMIT;
  }
  state.pupilX = stepSpring(state.pupilX, pupilTargetX, seconds, PUPIL_SPRING);
  state.pupilY = stepSpring(state.pupilY, pupilTargetY, seconds, PUPIL_SPRING);

  // The target is clamped to PUPIL_LIMIT and the spring's overshoot stays
  // inside the eye; this is the hard net behind both, so the pupil cannot
  // cross the shell's rim no matter how the state was arrived at.
  const pupilLength = Math.hypot(state.pupilX.position, state.pupilY.position);
  if (pupilLength > TILE.eye - TILE.pupil) {
    const scale = (TILE.eye - TILE.pupil) / pupilLength;
    state.pupilX.position *= scale;
    state.pupilY.position *= scale;
  }

  if (state.blinkQueue > 0 && state.blinkPhase >= BLINK_CYCLE) {
    state.blinkPhase = 0;
    state.blinkQueue -= 1;
  } else if (state.blinkPhase < BLINK_CYCLE) {
    state.blinkPhase += seconds;
  }
}
