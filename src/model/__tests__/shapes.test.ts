import { describe, test, expect } from '@jest/globals'
import { BUILTIN_SHAPES, buildDrawnShapePath, getShape } from '../shapes'

describe('buildDrawnShapePath (draw-a-shape)', () => {
  test('normalizes to the 0..1 box and keeps the drawn aspect', () => {
    // a wide 200x100 zigzag
    const out = buildDrawnShapePath([
      [
        { x: 100, y: 300 },
        { x: 200, y: 350 },
        { x: 250, y: 320 },
        { x: 300, y: 400 },
      ],
    ])!
    expect(out).not.toBeNull()
    expect(out.aspect).toBeCloseTo(2)
    // every coordinate in the path stays inside the unit box (with
    // Catmull-Rom overshoot tolerance)
    const nums = out.path.match(/-?\d+(\.\d+)?/g)!.map(Number)
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(-0.2)
      expect(n).toBeLessThanOrEqual(1.2)
    }
    expect(out.path.startsWith('M')).toBe(true)
    expect(out.path.endsWith('Z')).toBe(true)
  })

  test('each stroke becomes its own closed subpath', () => {
    const ring = (cx: number, cy: number, r: number) =>
      Array.from({ length: 12 }, (_, i) => ({
        x: cx + r * Math.cos((i / 12) * 2 * Math.PI),
        y: cy + r * Math.sin((i / 12) * 2 * Math.PI),
      }))
    const out = buildDrawnShapePath([ring(0, 0, 50), ring(0, 0, 20)])!
    expect(out.path.match(/Z/g)).toHaveLength(2)
    expect(out.path.match(/M/g)).toHaveLength(2)
    expect(out.aspect).toBeCloseTo(1)
  })

  test('rejects drawings with no usable ink', () => {
    expect(buildDrawnShapePath([])).toBeNull()
    expect(buildDrawnShapePath([[{ x: 5, y: 5 }]])).toBeNull()
  })

  test('rectangle builtin exists with a wide default aspect', () => {
    const rect = getShape('rect')!
    expect(rect.defaultAspect).toBeCloseTo(1.6)
    expect(BUILTIN_SHAPES.some((s) => s.id === 'rect')).toBe(true)
  })
})
