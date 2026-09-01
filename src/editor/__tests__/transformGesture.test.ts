import { test, expect } from '@jest/globals'
import type { CardDocument, Layer } from '../../model/types'
import { layerBounds } from '../bounds'
import {
  MAX_SCALE,
  MIN_SCALE,
  applyPinch,
  applyResize,
  applyRotate,
  beginPinch,
  beginResize,
  beginRotate,
  localToDoc,
} from '../transformGesture'

// Pure math for the two-finger transform. The core invariant: the layer's
// visual center at gesture start stays glued to the finger midpoint.

const doc = { size: { w: 750, h: 1050 } } as CardDocument

function shapeLayer(t: Partial<Layer['transform']> = {}): Layer {
  return {
    id: 's1',
    name: 'Square',
    type: 'shape',
    transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1, ...t },
    opacity: 1,
    blendMode: 'srcOver',
    locked: false,
    visible: true,
    shape: { shapeId: 'square', paint: { color: '#ffffff' }, w: 100, h: 100 },
  }
}

// 100x100 square at (100,100) → bounds center (150,150), local center (50,50)

test('pure pinch scales uniformly about the layer center', () => {
  const layer = shapeLayer()
  const start = beginPinch(layer, doc, { x: 100, y: 150 }, { x: 200, y: 150 })!
  const next = applyPinch(start, { x: 75, y: 150 }, { x: 225, y: 150 })
  expect(next.scaleX).toBeCloseTo(1.5)
  expect(next.scaleY).toBeCloseTo(1.5)
  expect(next.rotation).toBeCloseTo(0)
  expect(next.x).toBeCloseTo(75)
  expect(next.y).toBeCloseTo(75)
  const center = localToDoc(next, start.pivotLocal)
  expect(center.x).toBeCloseTo(150)
  expect(center.y).toBeCloseTo(150)
})

test('rotate handle turns about the bounds center, scale untouched', () => {
  const layer = shapeLayer()
  // handle grabbed straight above the center, dragged to the right side
  const start = beginRotate(layer, doc, { x: 150, y: 80 })!
  const next = applyRotate(start, { x: 220, y: 150 })
  expect(next.rotation).toBeCloseTo(90)
  expect(next.scaleX).toBeCloseTo(1)
  expect(next.scaleY).toBeCloseTo(1)
  const center = localToDoc(next, start.pivotLocal)
  expect(center.x).toBeCloseTo(150)
  expect(center.y).toBeCloseTo(150)
})

test('rotate handle snaps near 45° multiples', () => {
  const layer = shapeLayer()
  const start = beginRotate(layer, doc, { x: 150, y: 80 })!
  // 44° from start — inside the 3° magnet around 45°
  const rad = ((45 - 1) * Math.PI) / 180
  const p = { x: 150 - 70 * Math.sin(-rad), y: 150 - 70 * Math.cos(rad) }
  const next = applyRotate(start, p)
  expect(next.rotation).toBeCloseTo(45)
  // and rotation on an already-rotated layer accumulates (its bounds
  // center has moved, so derive the pivot the way the editor does)
  const tilted = shapeLayer({ rotation: 30 })
  const tb = layerBounds(tilted, doc)
  const c = { x: tb.x + tb.w / 2, y: tb.y + tb.h / 2 }
  const s2 = beginRotate(tilted, doc, { x: c.x, y: c.y - 70 })!
  const n2 = applyRotate(s2, { x: c.x + 70, y: c.y })
  expect(n2.rotation).toBeCloseTo(120)
  const center = localToDoc(n2, s2.pivotLocal)
  expect(center.x).toBeCloseTo(c.x)
  expect(center.y).toBeCloseTo(c.y)
})

test('twist rotates about the layer center', () => {
  const layer = shapeLayer()
  const start = beginPinch(layer, doc, { x: 100, y: 150 }, { x: 200, y: 150 })!
  const next = applyPinch(start, { x: 150, y: 100 }, { x: 150, y: 200 })
  expect(next.rotation).toBeCloseTo(90)
  expect(next.scaleX).toBeCloseTo(1)
  expect(next.x).toBeCloseTo(200)
  expect(next.y).toBeCloseTo(100)
  const center = localToDoc(next, start.pivotLocal)
  expect(center.x).toBeCloseTo(150)
  expect(center.y).toBeCloseTo(150)
})

test('moving both fingers pans the layer', () => {
  const layer = shapeLayer()
  const start = beginPinch(layer, doc, { x: 100, y: 150 }, { x: 200, y: 150 })!
  const next = applyPinch(start, { x: 130, y: 150 }, { x: 230, y: 150 })
  expect(next).toMatchObject({ rotation: 0 })
  expect(next.x).toBeCloseTo(130)
  expect(next.y).toBeCloseTo(100)
})

test('center follows the midpoint through an arbitrary gesture on a rotated layer', () => {
  const layer = shapeLayer({ rotation: 45, scaleX: 1.2, scaleY: 1.2 })
  const a0 = { x: 120, y: 140 }
  const b0 = { x: 210, y: 160 }
  const start = beginPinch(layer, doc, a0, b0)!
  const a1 = { x: 100, y: 150 }
  const b1 = { x: 230, y: 110 }
  const next = applyPinch(start, a1, b1)
  const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }
  const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 }
  const center = localToDoc(next, start.pivotLocal)
  expect(center.x).toBeCloseTo(start.pivot.x + (mid1.x - mid0.x))
  expect(center.y).toBeCloseTo(start.pivot.y + (mid1.y - mid0.y))
})

test('scale clamps at both ends', () => {
  const layer = shapeLayer()
  const start = beginPinch(layer, doc, { x: 145, y: 150 }, { x: 155, y: 150 })!
  const huge = applyPinch(start, { x: -5000, y: 150 }, { x: 5000, y: 150 })
  expect(huge.scaleX).toBeCloseTo(MAX_SCALE)
  const wide = beginPinch(layer, doc, { x: 0, y: 150 }, { x: 700, y: 150 })!
  const tiny = applyPinch(wide, { x: 349, y: 150 }, { x: 351, y: 150 })
  expect(tiny.scaleX).toBeCloseTo(MIN_SCALE)
})

test('rotation stays normalized to (-180, 180]', () => {
  const layer = shapeLayer({ rotation: 170 })
  const start = beginPinch(layer, doc, { x: 100, y: 150 }, { x: 200, y: 150 })!
  // +30° twist: rotate both touches by 30° around the midpoint
  const rad = (30 * Math.PI) / 180
  const rot = (p: { x: number; y: number }) => ({
    x: 150 + (p.x - 150) * Math.cos(rad) - (p.y - 150) * Math.sin(rad),
    y: 150 + (p.x - 150) * Math.sin(rad) + (p.y - 150) * Math.cos(rad),
  })
  const next = applyPinch(start, rot({ x: 100, y: 150 }), rot({ x: 200, y: 150 }))
  expect(next.rotation).toBeCloseTo(-160)
})

test('twist snaps to cardinal angles within the snap window', () => {
  const layer = shapeLayer()
  const start = beginPinch(layer, doc, { x: 100, y: 150 }, { x: 200, y: 150 })!
  // ~88°: rotate the touch pair by 88° around the midpoint
  const rad = (88 * Math.PI) / 180
  const rot = (p: { x: number; y: number }) => ({
    x: 150 + (p.x - 150) * Math.cos(rad) - (p.y - 150) * Math.sin(rad),
    y: 150 + (p.x - 150) * Math.sin(rad) + (p.y - 150) * Math.cos(rad),
  })
  const next = applyPinch(start, rot({ x: 100, y: 150 }), rot({ x: 200, y: 150 }))
  expect(next.rotation).toBe(90)
})

test('corner resize makes a rectangle from a square, anchor pinned', () => {
  // square 100..200 x 100..200; drag bottom-right corner to (400, 250):
  // width x3, height x1.5 — a rectangle at last
  const layer = shapeLayer()
  const start = beginResize(layer, doc, 3)!
  expect(start.anchor).toEqual({ x: 100, y: 100 })
  const next = applyResize(start, { x: 400, y: 250 })
  expect(next.scaleX).toBeCloseTo(3)
  expect(next.scaleY).toBeCloseTo(1.5)
  expect(next.rotation).toBe(0)
  // the anchored top-left corner must not move
  const anchored = localToDoc(next, start.anchorLocal)
  expect(anchored.x).toBeCloseTo(100)
  expect(anchored.y).toBeCloseTo(100)
})

test('corner resize stays exact on a rotated layer', () => {
  const layer = shapeLayer({ rotation: 30 })
  const start = beginResize(layer, doc, 0)! // drag top-left, pin bottom-right
  const next = applyResize(start, { x: 60, y: 20 })
  const anchored = localToDoc(next, start.anchorLocal)
  expect(anchored.x).toBeCloseTo(start.anchor.x)
  expect(anchored.y).toBeCloseTo(start.anchor.y)
  expect(next.rotation).toBeCloseTo(30)
})

test('resize clamps scale and rejects degenerate layers', () => {
  const layer = shapeLayer()
  const start = beginResize(layer, doc, 3)!
  const tiny = applyResize(start, { x: 100.5, y: 100.5 })
  expect(tiny.scaleX).toBeCloseTo(MIN_SCALE)
  expect(beginResize(shapeLayer({ scaleX: 0 }), doc, 0)).toBeNull()
})

test('degenerate starts return null', () => {
  expect(beginPinch(shapeLayer(), doc, { x: 150, y: 150 }, { x: 150, y: 150 })).toBeNull()
  expect(
    beginPinch(shapeLayer({ scaleX: 0 }), doc, { x: 100, y: 150 }, { x: 200, y: 150 }),
  ).toBeNull()
})
