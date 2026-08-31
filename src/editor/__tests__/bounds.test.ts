import { describe, test, expect } from '@jest/globals'
import { layerBounds, hitTest } from '../bounds'
import { blankCard } from '../../templates/blank'
import { makeFillLayer, makeShapeLayer } from '../../state/editorStore'
import type { CardDocument, Layer } from '../../model/types'

const docWith = (layers: Layer[]): CardDocument => {
  const doc = blankCard('bounds-test')
  doc.front.layers = layers
  return doc
}

describe('layerBounds', () => {
  test('translated shape', () => {
    const layer = makeShapeLayer('square', { color: '#fff' }, 100)
    layer.transform = { x: 50, y: 60, rotation: 0, scaleX: 1, scaleY: 1 }
    expect(layerBounds(layer, docWith([layer]))).toEqual({ x: 50, y: 60, w: 100, h: 100 })
  })

  test('scale applies before translate, like the renderer', () => {
    const layer = makeShapeLayer('square', { color: '#fff' }, 100)
    layer.transform = { x: 10, y: 10, rotation: 0, scaleX: 2, scaleY: 0.5 }
    expect(layerBounds(layer, docWith([layer]))).toEqual({ x: 10, y: 10, w: 200, h: 50 })
  })

  test('90° rotation swaps extents around the origin', () => {
    const layer = makeShapeLayer('square', { color: '#fff' }, 100)
    layer.transform = { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 }
    const b = layerBounds(layer, docWith([layer]))
    expect(b.x).toBeCloseTo(-100)
    expect(b.y).toBeCloseTo(0)
    expect(b.w).toBeCloseTo(100)
    expect(b.h).toBeCloseTo(100)
  })
})

describe('hitTest', () => {
  test('picks the topmost layer and treats full-card fill as a fallback', () => {
    const fill = makeFillLayer({ color: '#000' })
    const shape = makeShapeLayer('square', { color: '#fff' }, 100)
    shape.transform = { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 }
    const doc = docWith([fill, shape])

    expect(hitTest(doc, 'front', 150, 150)?.id).toBe(shape.id)
    expect(hitTest(doc, 'front', 500, 500)?.id).toBe(fill.id)
  })

  test('ignores hidden and locked layers', () => {
    const shape = makeShapeLayer('square', { color: '#fff' }, 100)
    shape.transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
    shape.locked = true
    const doc = docWith([shape])
    expect(hitTest(doc, 'front', 50, 50)).toBeNull()
  })
})
