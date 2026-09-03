import { test, expect } from '@jest/globals'
import { initialBaseline, nextBaseline, type Baseline } from '../tiltMath'

// The gyro neutral pose is whatever pose the phone is HELD in: it settles
// there quickly once the phone is still, and never drifts while the phone
// is moving (beta feedback: the old slow constant drift took ~20s to
// recenter and dragged on deliberate tilts).

const GYRO_RANGE = 0.6

type Pose = { beta: number; gamma: number }

/** Feed `readings` poses (33ms apart) from `poseAt(i)` into the baseline. */
function run(start: Pose, poseAt: (i: number) => Pose, readings: number, from?: Baseline) {
  let baseline = from ?? initialBaseline(start)
  for (let i = 0; i < readings; i++) {
    const held = poseAt(i)
    const dx = (held.gamma - baseline.gamma) / GYRO_RANGE
    const dy = (held.beta - baseline.beta) / GYRO_RANGE
    baseline = nextBaseline(baseline, held, Math.max(Math.abs(dx), Math.abs(dy)))
  }
  return baseline
}

const offsetMag = (b: Pose, held: Pose) => Math.abs(held.beta - b.beta) / GYRO_RANGE

test('holding the phone at a new angle recenters within a few seconds', () => {
  const held = { beta: 0.3, gamma: 0.25 }
  const after3s = run({ beta: 0, gamma: 0 }, () => held, 90)
  expect(Math.abs(after3s.beta - 0.3)).toBeLessThan(0.05)
  expect(Math.abs(after3s.gamma - 0.25)).toBeLessThan(0.05)
})

test('launching sideways is absorbed fast, then settles completely', () => {
  const start = { beta: -1.2, gamma: -1.2 } // way past full tilt
  const held = { beta: 0, gamma: 0 }
  const after1s = run(start, () => held, 30)
  expect(offsetMag(after1s, held)).toBeLessThan(1.05)
  const after4s = run(start, () => held, 120)
  expect(offsetMag(after4s, held)).toBeLessThan(0.1)
})

test('deliberately tilting around never drags the neutral pose', () => {
  // a slow figure-eight admiring wobble: amplitude 0.4 rad, ~2s period
  const wobble = (i: number) => ({
    beta: 0.4 * Math.sin((i / 60) * 2 * Math.PI),
    gamma: 0.4 * Math.cos((i / 60) * 2 * Math.PI),
  })
  const b = run({ beta: 0, gamma: 0 }, wobble, 600) // 20s of motion
  expect(Math.abs(b.beta)).toBeLessThan(0.03)
  expect(Math.abs(b.gamma)).toBeLessThan(0.03)
})

test('a brief pause mid-tilt does not start recentering', () => {
  // 300ms held at a tilt (under the 500ms hold) after moving there
  const moving = run({ beta: 0, gamma: 0 }, (i) => ({ beta: i * 0.02, gamma: 0 }), 25)
  const paused = run({ beta: 0, gamma: 0 }, () => ({ beta: 0.5, gamma: 0 }), 9, moving)
  expect(Math.abs(paused.beta)).toBeLessThan(0.01)
})
