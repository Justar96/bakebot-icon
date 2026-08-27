/**
 * The one numerical integrator the mascot uses.
 *
 * Nothing here knows about eyes. Keeping it separate is what lets the eye
 * module read as a description of behaviour — a shell spring, a pupil spring
 * and a deformation spring, each with its own damping ratio — rather than as
 * an integrator with behaviour mixed into it.
 */

export interface SpringValue {
  position: number;
  velocity: number;
}

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

export const DEFAULT_SPRING: SpringConfig = { stiffness: 100, damping: 10 };

/** A spring at rest at the origin. */
export const restingSpring = (): SpringValue => ({ position: 0, velocity: 0 });

/**
 * One semi-implicit Euler step: the new velocity moves the position, which is
 * what keeps the integrator stable at the step sizes used here.
 *
 * Degenerate input is refused rather than integrated: a zero or non-finite
 * step would write NaN or Infinity into the spring, and every force computed
 * from a poisoned value is NaN too, so the spring would never recover. An
 * exploded step (huge target, huge step) resets to rest for the same reason.
 */
export function stepSpring(
  value: SpringValue,
  target: number,
  seconds: number,
  spring: SpringConfig = DEFAULT_SPRING,
): SpringValue {
  if (!Number.isFinite(seconds) || seconds <= 0) return value;
  const rest = Number.isFinite(target) ? target : 0;
  const stiffness = Number.isFinite(spring.stiffness)
    ? Math.max(spring.stiffness, 0)
    : DEFAULT_SPRING.stiffness;
  const decay = Number.isFinite(spring.damping)
    ? Math.max(spring.damping, 0)
    : DEFAULT_SPRING.damping;

  const force = -stiffness * (value.position - rest);
  const drag = -decay * value.velocity;
  const velocity = value.velocity + (force + drag) * seconds;
  const position = value.position + velocity * seconds;

  if (!Number.isFinite(position) || !Number.isFinite(velocity)) return restingSpring();
  return { position, velocity };
}
