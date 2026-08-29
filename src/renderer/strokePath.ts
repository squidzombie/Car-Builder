import { Skia, type SkPath } from '@shopify/react-native-skia'
import type { Point } from '../model/types'

/**
 * Build a smoothed stroke path from raw input points using Catmull-Rom
 * converted to cubic Béziers (CLAUDE.md §4 free draw). Pure; safe to call
 * per render — editor should cache per layer.
 */
export function strokePathFromPoints(points: Point[]): SkPath {
  const path = Skia.Path.Make()
  if (points.length === 0) return path
  path.moveTo(points[0].x, points[0].y)
  if (points.length < 3) {
    for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y)
    return path
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    // Catmull-Rom to cubic Bézier (tension 0.5)
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    path.cubicTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y)
  }
  return path
}
