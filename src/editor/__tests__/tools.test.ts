import { test, expect } from '@jest/globals'
import { jitterInstance, mirrorRotation, stampRotation, symmetryVariants } from '../tools'

test('symmetry variant counts and mappings', () => {
  expect(symmetryVariants('off', 750, 1050)).toHaveLength(1)
  expect(symmetryVariants('h', 750, 1050)).toHaveLength(2)
  expect(symmetryVariants('v', 750, 1050)).toHaveLength(2)
  const both = symmetryVariants('both', 750, 1050)
  expect(both).toHaveLength(4)
  const p = { x: 100, y: 200 }
  expect(both.map((v) => v.map(p))).toEqual([
    { x: 100, y: 200 },
    { x: 650, y: 200 },
    { x: 100, y: 850 },
    { x: 650, y: 850 },
  ])
  expect(both.map((v) => v.flips)).toEqual([0, 1, 1, 2])
})

test('mirrorRotation negates per single flip only', () => {
  expect(mirrorRotation(30, 0)).toBe(30)
  expect(mirrorRotation(30, 1)).toBe(-30)
  expect(mirrorRotation(30, 2)).toBe(30)
})

test('stampRotation per mode', () => {
  expect(stampRotation('fixed', 77)).toBe(0)
  expect(stampRotation('follow', 77)).toBe(77)
  expect(stampRotation('random', 0, () => 0.5)).toBe(180)
})

test('jitterInstance stays within its wobble bounds', () => {
  const j = jitterInstance({ x: 100, y: 100 }, 80, () => 1)
  expect(j.x).toBeCloseTo(112)
  expect(j.y).toBeCloseTo(112)
  expect(j.scaleMul).toBeCloseTo(1.15)
  const k = jitterInstance({ x: 100, y: 100 }, 80, () => 0)
  expect(k.x).toBeCloseTo(88)
  expect(k.scaleMul).toBeCloseTo(0.85)
})
