import { describe, test, expect } from '@jest/globals'
import { adjustMatrix } from '../adjust'

// The photo-adjust color matrix: identity when neutral, and the expected
// scalings otherwise (rows are r, g, b, a; 5th column is translate).

const apply = (m: number[], rgb: [number, number, number]) => {
  const [r, g, b] = rgb
  return [0, 1, 2].map((row) => {
    const o = row * 5
    return m[o] * r + m[o + 1] * g + m[o + 2] * b + m[o + 4]
  })
}

describe('adjustMatrix', () => {
  test('neutral settings are the identity', () => {
    const m = adjustMatrix({ brightness: 0, contrast: 0, saturation: 1 })
    expect(apply(m, [0.2, 0.5, 0.9]).map((v) => +v.toFixed(6))).toEqual([0.2, 0.5, 0.9])
  })

  test('saturation 0 collapses to luminance grey', () => {
    const m = adjustMatrix({ brightness: 0, contrast: 0, saturation: 0 })
    const out = apply(m, [1, 0, 0])
    expect(out[0]).toBeCloseTo(0.2126)
    expect(out[1]).toBeCloseTo(0.2126)
    expect(out[2]).toBeCloseTo(0.2126)
  })

  test('contrast keeps mid-grey fixed and brightness scales', () => {
    const c = adjustMatrix({ brightness: 0, contrast: 0.5, saturation: 1 })
    expect(apply(c, [0.5, 0.5, 0.5])[0]).toBeCloseTo(0.5)
    expect(apply(c, [0.8, 0.8, 0.8])[0]).toBeCloseTo(0.95)
    const b = adjustMatrix({ brightness: 0.5, contrast: 0, saturation: 1 })
    expect(apply(b, [0.4, 0.4, 0.4])[0]).toBeCloseTo(0.6)
  })
})
