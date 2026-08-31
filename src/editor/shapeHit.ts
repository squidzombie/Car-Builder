import { Skia } from '@shopify/react-native-skia'
import type { SkPath } from '@shopify/react-native-skia'
import type { CardDocument } from '../model/types'
import { getShape } from '../model/shapes'

// Skia-backed point-in-shape test for hitTest (bounds.ts stays pure; the
// editor injects this). Paths are normalized to the 0..1 box, so callers
// pass normalized coordinates. Parsed paths are cached by their SVG string
// so custom document shapes are covered too.

const cache = new Map<string, SkPath | null>()

/** Build a shapeContains that resolves ids against the doc's custom shapes. */
export function makeShapeContains(doc: CardDocument) {
  return (shapeId: string, u: number, v: number): boolean => {
    const shape = getShape(shapeId, doc.shapes)
    if (!shape) return true
    let path = cache.get(shape.path)
    if (path === undefined) {
      path = Skia.Path.MakeFromSVGString(shape.path)
      cache.set(shape.path, path)
    }
    return path ? path.contains(u, v) : true
  }
}
