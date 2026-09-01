import { PathOp, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia'
import type { Point } from '../model/types'
import { strokePathFromPoints } from '../renderer/strokePath'

// "Ink" variant of the draw-a-shape builder (the filled variant is pure
// string math in model/shapes.ts). The strokes themselves become the
// shape: each smoothed stroke is expanded to its outline at the chosen
// width, the outlines are unioned, and the result is normalized to the
// 0..1 box like every other Shape path. Skia-dependent, so it lives in
// editor land — the output is a plain SVG string any consumer can parse.

export function buildInkShapePath(
  strokes: Point[][],
  width: number,
): { path: string; aspect: number } | null {
  const inked = strokes.filter((s) => s.length >= 2)
  if (inked.length === 0) return null

  let union: ReturnType<typeof Skia.Path.Make> | null = null
  for (const s of inked) {
    const p = strokePathFromPoints(s)
    const ok = p.stroke({ width, cap: StrokeCap.Round, join: StrokeJoin.Round })
    if (!ok) continue
    if (!union) {
      union = p
      continue
    }
    // union keeps overlaps solid and avoids double-drawn seams
    const merged = Skia.Path.MakeFromOp(union, p, PathOp.Union)
    if (merged) union = merged
    else union.addPath(p)
  }
  if (!union) return null

  const b = union.computeTightBounds()
  const span = Math.max(b.width, b.height)
  if (span < 1e-3) return null
  const nw = Math.max(b.width, span * 0.02)
  const nh = Math.max(b.height, span * 0.02)
  // later matrix calls apply first: translate to the origin, then scale
  const m = Skia.Matrix()
  m.scale(1 / nw, 1 / nh)
  m.translate(-b.x, -b.y)
  union.transform(m)

  const aspect = Math.max(0.1, Math.min(10, nw / nh))
  return { path: union.toSVGString(), aspect }
}
