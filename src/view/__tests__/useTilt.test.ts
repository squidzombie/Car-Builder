import { test, expect } from '@jest/globals'
import { nextBaseline } from '../tiltMath'

// The gyro neutral pose drifts toward the held pose (first beta feedback:
// launching with the phone tilted left the card skewed forever).

const GYRO_RANGE = 0.6

function simulate(
  start: { beta: number; gamma: number },
  held: { beta: number; gamma: number },
  readings: number,
) {
  let baseline = { ...start }
  for (let i = 0; i < readings; i++) {
    const dx = (held.gamma - baseline.gamma) / GYRO_RANGE
    const dy = (held.beta - baseline.beta) / GYRO_RANGE
    baseline = nextBaseline(baseline, held, Math.max(Math.abs(dx), Math.abs(dy)))
  }
  return baseline
}

const offsetMag = (b: { beta: number }, held: { beta: number }) =>
  Math.abs(held.beta - b.beta) / GYRO_RANGE

test('launching sideways is no longer pinned within ~1s and keeps recovering', () => {
  const start = { beta: -1.2, gamma: -1.2 } // way past full tilt
  const held = { beta: 0, gamma: 0 }
  const after1s = simulate(start, held, 30)
  expect(offsetMag(after1s, held)).toBeLessThan(1.05) // excess absorbed fast
  const after20s = simulate(start, held, 600)
  expect(offsetMag(after20s, held)).toBeLessThan(0.2) // settles the rest of the way
})

test('a sustained in-range pose becomes the new neutral eventually', () => {
  const b = simulate({ beta: 0, gamma: 0 }, { beta: 0.3, gamma: 0.3 }, 600)
  expect(Math.abs(b.beta - 0.3)).toBeLessThan(0.05)
})

test('deliberately holding a tilt for a few seconds barely fades the shine', () => {
  // 3s at a strong in-range tilt: baseline should absorb only a sliver
  const b = simulate({ beta: 0, gamma: 0 }, { beta: 0.5, gamma: 0.5 }, 90)
  expect(Math.abs(b.beta)).toBeLessThan(0.16)
})
