// Pure tilt math (no native imports) so it stays unit-testable; useTilt
// wires it to the gyroscope, gestures, and the Reanimated shared value.

export const DEAD_ZONE = 0.03
export const GYRO_RANGE = 0.6 // radians of device rotation mapped to full tilt

// The neutral pose is whatever pose the phone is HELD in. Rest detection
// (beta feedback: the old slow constant drift took ~20s to recenter and
// dragged on deliberate tilts):
// - while the phone is moving, the neutral pose does not drift at all,
//   so tilting to admire the shine is never fought;
// - once it has been held still for STILL_HOLD_MS, the neutral pose
//   settles onto the held pose with a ~1.1s time constant — tilt works
//   from any angle within a couple of seconds of settling there;
// - an offset pinned PAST full tilt (launched sideways) is absorbed fast
//   regardless, until back in range.
export const STILL_RATE = 0.006 // rad per ~33ms reading (≈10°/s) — below this the pose counts as held
export const STILL_HOLD_MS = 500
export const SETTLE_DRIFT = 0.03 // per reading once held (tau ≈ 1.1s)
export const BASELINE_DRIFT_PINNED = 0.05

export type Baseline = {
  beta: number
  gamma: number
  /** how long the pose has been held still, ms */
  stillMs: number
  /** previous reading, for the speed estimate */
  last: { beta: number; gamma: number } | null
}

export function initialBaseline(rot: { beta: number; gamma: number }): Baseline {
  return { beta: rot.beta, gamma: rot.gamma, stillMs: 0, last: null }
}

export function applyDeadZone(v: number): number {
  if (Math.abs(v) < DEAD_ZONE) return 0
  return Math.sign(v) * ((Math.abs(v) - DEAD_ZONE) / (1 - DEAD_ZONE))
}

/** Pure baseline update for one gyro reading. */
export function nextBaseline(
  state: Baseline,
  rot: { beta: number; gamma: number },
  offsetMagnitude: number,
  dtMs = 33,
): Baseline {
  const speed = state.last
    ? Math.max(Math.abs(rot.beta - state.last.beta), Math.abs(rot.gamma - state.last.gamma))
    : 0
  const stillMs = speed < STILL_RATE ? state.stillMs + dtMs : 0
  const f =
    offsetMagnitude > 1 ? BASELINE_DRIFT_PINNED : stillMs >= STILL_HOLD_MS ? SETTLE_DRIFT : 0
  return {
    beta: state.beta + (rot.beta - state.beta) * f,
    gamma: state.gamma + (rot.gamma - state.gamma) * f,
    stillMs,
    last: { beta: rot.beta, gamma: rot.gamma },
  }
}

export const clamp = (v: number) => Math.max(-1, Math.min(1, v))
