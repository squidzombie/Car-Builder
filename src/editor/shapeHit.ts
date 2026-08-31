import { Skia } from '@shopify/react-native-skia'
import type { SkPath } from '@shopify/react-native-skia'
import { getShape } from '../model/shapes'

// Skia-backed point-in-shape test for hitTest (bounds.ts stays pure; the
// editor injects this). Paths are normalized to the 0..1 box, so callers
// pass normalized coordinates. Parsed paths are cached per shape id.

const cache = new Map<string, SkPath | null>()

export function shapeContains(shapeId: string, u: number, v: number): boolean {
  let path = cache.get(shapeId)
  if (path === undefined) {
    const shape = getShape(shapeId)
    path = shape ? Skia.Path.MakeFromSVGString(shape.path) : null
    cache.set(shapeId, path)
  }
  return path ? path.contains(u, v) : true
}
