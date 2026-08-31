import type { CardDocument, Layer } from '../model/types'

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
      if (p.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const pt of p.points) {
        minX = Math.min(minX, pt.x)
        minY = Math.min(minY, pt.y)
        maxX = Math.max(maxX, pt.x)
        maxY = Math.max(maxY, pt.y)
      }
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

/**
 * Topmost visible, unlocked layer under a document-space point.
 * Full-card fills only match as a last resort so they don't shadow
 * everything sitting on top of them.
 */
export function hitTest(
  doc: CardDocument,
  side: 'front' | 'back',
  x: number,
  y: number,
): Layer | null {
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
    return layer
  }
  return fillFallback
}
