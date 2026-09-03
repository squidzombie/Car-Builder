// Pure tilt math (no native imports) so it stays unit-testable; useTilt
// wires it to the gyroscope, gestures, and the Reanimated shared value.

export const DEAD_ZONE = 0.03
export const GYRO_RANGE = 0.6 // radians of device rotation mapped to full tilt

// The neutral pose is not fixed: it drifts toward however the phone is
// actually being held, so launching with the phone tilted (or settling
// into a new position) self-corrects instead of leaving the card skewed
// (first beta feedback). Slow enough that quick tilts still shine.
// Two speeds: ambient drift is slow (tau ~8s) so deliberately holding a
// tilt to admire the shine barely fades, but an offset pinned PAST full
// tilt (the launched-sideways case) is absorbed fast until back in range.
export const BASELINE_DRIFT = 0.004 // per ~33ms reading
export const BASELINE_DRIFT_PINNED = 0.05

export function applyDeadZone(v: number): number {
  if (Math.abs(v) < DEAD_ZONE) return 0
  return Math.sign(v) * ((Math.abs(v) - DEAD_ZONE) / (1 - DEAD_ZONE))
}

/** Pure baseline update for one gyro reading. */
export function nextBaseline(
  baseline: { beta: number; gamma: number },
  rot: { beta: number; gamma: number },
  offsetMagnitude: number,
): { beta: number; gamma: number } {
  const f = offsetMagnitude > 1 ? BASELINE_DRIFT_PINNED : BASELINE_DRIFT
  return {
    beta: baseline.beta + (rot.beta - baseline.beta) * f,
    gamma: baseline.gamma + (rot.gamma - baseline.gamma) * f,
  }
}

export const clamp = (v: number) => Math.max(-1, Math.min(1, v))
