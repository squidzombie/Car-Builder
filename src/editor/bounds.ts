import type { CardDocument, Layer } from '../model/types'
import { parseColor } from '../model/color'

// Pure geometry for the editor: layer bounding boxes in document space,
// used for the selection outline and tap hit-testing. Approximate on
// purpose — selection UX needs "close enough", not typography-exact.

export type Box = { x: number; y: number; w: number; h: number }

/** Untransformed (layer-local) bounds for each layer type. */
function localBounds(layer: Layer, doc: CardDocument): Box {
  const { w, h } = doc.size
  switch (layer.type) {
    case 'fill':
      return { x: 0, y: 0, w, h }
    case 'image': {
      const img = layer.image!
      return { x: 0, y: 0, w: img.w, h: img.h }
    }
    case 'shape': {
      const s = layer.shape!
      return { x: 0, y: 0, w: s.w, h: s.h }
    }
    case 'path': {
      const p = layer.path!
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const stroke of p.strokes) {
        for (const pt of stroke.points) {
          minX = Math.min(minX, pt.x)
          minY = Math.min(minY, pt.y)
          maxX = Math.max(maxX, pt.x)
          maxY = Math.max(maxY, pt.y)
        }
      }
      if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 }
      const pad = p.stroke.width // stroke half-width + Catmull-Rom overshoot
      return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad }
    }
    case 'stamp': {
      const s = layer.stamp!
      if (s.instances.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const inst of s.instances) {
        const half = (s.baseSize * inst.scale) / 2
        minX = Math.min(minX, inst.x - half)
        minY = Math.min(minY, inst.y - half)
        maxX = Math.max(maxX, inst.x + half)
        maxY = Math.max(maxY, inst.y + half)
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    }
    case 'text': {
      const t = layer.text!
      // crude glyph-average estimate; good enough for selection
      const width = t.content.length * t.size * 0.58
      const x = t.align === 'c' ? -width / 2 : t.align === 'r' ? -width : 0
      return { x, y: -t.size, w: width, h: t.size * 1.3 }
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 }
  }
}

/**
 * Document-space axis-aligned bounds of a layer, honoring its transform
 * (same order the renderer applies: scale, then rotate, then translate).
 */
export function layerBounds(layer: Layer, doc: CardDocument): Box {
  const b = localBounds(layer, doc)
  const t = layer.transform
  const rad = (t.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const corners: [number, number][] = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
  ]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [px, py] of corners) {
    const sx = px * t.scaleX
    const sy = py * t.scaleY
    const rx = sx * cos - sy * sin
    const ry = sx * sin + sy * cos
    const fx = rx + t.x
    const fy = ry + t.y
    minX = Math.min(minX, fx)
    minY = Math.min(minY, fy)
    maxX = Math.max(maxX, fx)
    maxY = Math.max(maxY, fy)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Invert the layer transform (scale → rotate → translate). Null when degenerate. */
export function toLocal(layer: Layer, x: number, y: number): { x: number; y: number } | null {
  const t = layer.transform
  if (t.scaleX === 0 || t.scaleY === 0) return null
  const rad = (-t.rotation * Math.PI) / 180
  const dx = x - t.x
  const dy = y - t.y
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad)
  return { x: rx / t.scaleX, y: ry / t.scaleY }
}

/** Extra reach around thin targets (path strokes, small stamps), in doc px. */
const HIT_SLOP = 14

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax
  const vy = by - ay
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2))
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}

export type HitTestOptions = {
  /**
   * Point-in-shape test in the shape's normalized 0..1 box (the editor
   * injects a Skia path test; pure fallback is the bounding box). Keeps a
   * full-card frame shape from shadowing every layer under it.
   */
  shapeContains?: (shapeId: string, u: number, v: number) => boolean
}

/** Refine an AABB hit per layer type so hollow/thin layers don't shadow. */
function hitsLayer(layer: Layer, x: number, y: number, opts?: HitTestOptions): boolean {
  switch (layer.type) {
    case 'shape': {
      const s = layer.shape!
      const p = toLocal(layer, x, y)
      if (!p) return false
      const u = p.x / s.w
      const v = p.y / s.h
      if (u < 0 || u > 1 || v < 0 || v > 1) return false
      if (!opts?.shapeContains) return true
      const contains = opts.shapeContains
      const fillAlpha = 'color' in s.paint ? parseColor(s.paint.color)[3] : 1
      if (fillAlpha > 0.02) return contains(s.shapeId, u, v)
      // Hollow shape (transparent fill, visible stroke only — e.g. a card
      // border frame): hit only near the outline. Approximate "near" by
      // scaling the point about the shape center: still inside when pushed
      // outward = deep interior (miss); inside once pulled inward = on or
      // just outside the outline (hit).
      const reach = (s.stroke?.width ?? 0) / 2 + 14
      const cx = 0.5
      const cy = 0.5
      const g = 1 + reach / Math.max(1, Math.min(s.w, s.h) / 2)
      const at = (k: number) => {
        const uu = cx + (u - cx) * k
        const vv = cy + (v - cy) * k
        return uu >= 0 && uu <= 1 && vv >= 0 && vv <= 1 && contains(s.shapeId, uu, vv)
      }
      const nearOutline = contains(s.shapeId, u, v) || at(1 / g)
      const deepInside = at(g)
      return nearOutline && !deepInside
    }
    case 'stamp': {
      const s = layer.stamp!
      const p = toLocal(layer, x, y)
      if (!p) return false
      for (const inst of s.instances) {
        const half = (s.baseSize * inst.scale) / 2 + HIT_SLOP
        if (Math.abs(p.x - inst.x) <= half && Math.abs(p.y - inst.y) <= half) return true
      }
      return false
    }
    case 'path': {
      const pl = layer.path!
      const p = toLocal(layer, x, y)
      if (!p) return false
      const reach = pl.stroke.width / 2 + HIT_SLOP
      for (const stroke of pl.strokes) {
        const pts = stroke.points
        if (pts.length === 0) continue
        if (pts.length === 1) {
          if (Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= reach) return true
          continue
        }
        for (let i = 0; i < pts.length - 1; i++) {
          if (distToSegment(p.x, p.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= reach)
            return true
        }
      }
      return false
    }
    default:
      return true // image/text: the AABB gate is the test
  }
}

/**
 * Topmost visible, unlocked layer under a document-space point. The AABB is
 * a cheap gate; shape/stamp/path hits are then refined so hollow layers
 * (e.g. a full-card border frame) don't shadow everything below. Full-card
 * fills only match as a last resort.
 */
export function hitTest(
  doc: CardDocument,
  side: 'front' | 'back',
  x: number,
  y: number,
  opts?: HitTestOptions,
): Layer | null {
  // everything renders clipped to the card, so outside it nothing hits —
  // this also makes "tap beside the card" a reliable deselect
  if (x < 0 || x > doc.size.w || y < 0 || y > doc.size.h) return null
  const layers = doc[side].layers
  let fillFallback: Layer | null = null
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    if (!layer.visible || layer.locked) continue
    const b = layerBounds(layer, doc)
    const inside = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    if (!inside) continue
    if (layer.type === 'fill') {
      fillFallback = fillFallback ?? layer
      continue
    }
    if (hitsLayer(layer, x, y, opts)) return layer
  }
  return fillFallback
}
