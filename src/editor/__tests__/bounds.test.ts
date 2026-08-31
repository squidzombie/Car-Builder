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

  test('points outside the card hit nothing, even when a layer box reaches there', () => {
    const shape = makeShapeLayer('square', { color: '#fff' }, 400)
    shape.transform = { x: -200, y: 100, rotation: 0, scaleX: 1, scaleY: 1 }
    const doc = docWith([shape])
    expect(hitTest(doc, 'front', 100, 200)?.id).toBe(shape.id) // on-card part
    expect(hitTest(doc, 'front', -100, 200)).toBeNull() // clipped part
  })

  test('ignores hidden and locked layers', () => {
    const shape = makeShapeLayer('square', { color: '#fff' }, 100)
    shape.transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
    shape.locked = true
    const doc = docWith([shape])
    expect(hitTest(doc, 'front', 50, 50)).toBeNull()
  })

  test('shapeContains refines shape hits so hollow shapes fall through', () => {
    const under = makeShapeLayer('circle', { color: '#00f' }, 100)
    under.transform = { x: 300, y: 300, rotation: 0, scaleX: 1, scaleY: 1 }
    // full-card "frame": only the outer 10% band of its box is solid
    const frame = makeShapeLayer('square', { color: '#fff' }, 750)
    frame.transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1.4 }
    const doc = docWith([under, frame])
    const opts = {
      shapeContains: (id: string, u: number, v: number) =>
        id !== frame.shape!.shapeId ||
        u < 0.1 || u > 0.9 || v < 0.1 || v > 0.9,
    }
    // center of the card: outside the frame's solid band → the layer below
    expect(hitTest(doc, 'front', 350, 350, opts)?.id).toBe(under.id)
    // near the card edge: on the band → the frame
    expect(hitTest(doc, 'front', 20, 500, opts)?.id).toBe(frame.id)
    // without the refinement the frame's box shadows everything (old behavior)
    expect(hitTest(doc, 'front', 350, 350)?.id).toBe(frame.id)
  })

  test('transparent-fill shapes (border frames) hit only near their outline', () => {
    const photo = makeShapeLayer('circle', { color: '#00ff00' }, 200)
    photo.transform = { x: 275, y: 400, rotation: 0, scaleX: 1, scaleY: 1 }
    const frame = makeShapeLayer('square', { color: '#00000000' }, 714)
    frame.shape!.stroke = { color: '#ffffff', width: 14 }
    frame.transform = { x: 18, y: 18, rotation: 0, scaleX: 1, scaleY: 1.42 }
    const doc = docWith([photo, frame])
    const opts = { shapeContains: () => true } // square = its whole box
    // hollow interior falls through to the layer underneath
    expect(hitTest(doc, 'front', 375, 500, opts)?.id).toBe(photo.id)
    // on the stroke band the frame itself hits
    expect(hitTest(doc, 'front', 25, 500, opts)?.id).toBe(frame.id)
  })

  test('stamp layers hit per instance, not by their union box', () => {
    const stamp: Layer = {
      id: 'st1',
      name: 'Stars',
      type: 'stamp',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      opacity: 1,
      blendMode: 'srcOver',
      locked: false,
      visible: true,
      stamp: {
        shapeId: 'star5',
        paint: { color: '#fff' },
        baseSize: 60,
        instances: [
          { x: 100, y: 100, rotation: 0, scale: 1 },
          { x: 600, y: 900, rotation: 0, scale: 1 },
        ],
      },
    }
    const doc = docWith([stamp])
    expect(hitTest(doc, 'front', 100, 100)?.id).toBe(stamp.id)
    // middle of the union box, far from both instances
    expect(hitTest(doc, 'front', 350, 500)).toBeNull()
  })

  test('path layers hit near the stroke, not across their box', () => {
    const path: Layer = {
      id: 'p1',
      name: 'Line',
      type: 'path',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      opacity: 1,
      blendMode: 'srcOver',
      locked: false,
      visible: true,
      path: {
        stroke: { color: '#fff', width: 20 },
        strokes: [
          {
            points: [
              { x: 100, y: 100 },
              { x: 700, y: 700 },
            ],
          },
        ],
      },
    }
    const doc = docWith([path])
    expect(hitTest(doc, 'front', 400, 400)?.id).toBe(path.id) // on the line
    expect(hitTest(doc, 'front', 400, 415)?.id).toBe(path.id) // within reach
    expect(hitTest(doc, 'front', 600, 300)).toBeNull() // inside box, far from stroke
  })
})
