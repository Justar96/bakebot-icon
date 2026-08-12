/**
 * The one numerical integrator the mark uses.
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
 */
export function stepSpring(
  value: SpringValue,
  target: number,
  seconds: number,
  spring: SpringConfig = DEFAULT_SPRING,
): SpringValue {
  const force = -spring.stiffness * (value.position - target);
  const damping = -spring.damping * value.velocity;
  const velocity = value.velocity + (force + damping) * seconds;

  return {
    position: value.position + velocity * seconds,
    velocity,
  };
}
