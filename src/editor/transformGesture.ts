import type { CardDocument, Layer } from '../model/types'
import { layerBounds } from './bounds'

// Pure math for the two-finger transform gesture (CLAUDE.md §4: pinch to
// scale, twist to rotate). All coordinates are DOCUMENT space — the caller
// divides view coordinates by its render scale first.
//
// The renderer applies scale, then rotation, then translation, so a local
// point p lands at  doc = t + R(rot) · S(scale) · p.  The gesture keeps one
// anchor point — the layer's visual center at gesture start — pinned under
// the fingers: it follows the midpoint of the two touches while scale and
// rotation change around it.

export type TouchPoint = { x: number; y: number }
export type Transform = Layer['transform']

export const MIN_SCALE = 0.05
export const MAX_SCALE = 20
/** Twist snaps to 0/±90/180 when within this many degrees. */
export const ROTATION_SNAP_DEG = 3

export function pinchGeometry(a: TouchPoint, b: TouchPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return {
    dist: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  }
}

export type PinchStart = {
  transform: Transform
  /** doc-space anchor (layer bounds center at gesture start) */
  pivot: TouchPoint
  /** the same anchor in layer-local space */
  pivotLocal: TouchPoint
  dist: number
  angle: number
  mid: TouchPoint
}

/** Snapshot the gesture baseline. Null when the pinch is degenerate. */
export function beginPinch(
  layer: Layer,
  doc: CardDocument,
  a: TouchPoint,
  b: TouchPoint,
): PinchStart | null {
  const g = pinchGeometry(a, b)
  const t = layer.transform
  if (g.dist < 1 || t.scaleX === 0 || t.scaleY === 0) return null
  const box = layerBounds(layer, doc)
  const pivot = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  // invert translate → rotate → scale to find the pivot in local space
  const rad = (-t.rotation * Math.PI) / 180
  const dx = pivot.x - t.x
  const dy = pivot.y - t.y
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad)
  return {
    transform: { ...t },
    pivot,
    pivotLocal: { x: rx / t.scaleX, y: ry / t.scaleY },
    dist: g.dist,
    angle: g.angle,
    mid: g.mid,
  }
}

/** New transform for the current finger positions. Pure; call per move. */
export function applyPinch(start: PinchStart, a: TouchPoint, b: TouchPoint): Transform {
  const g = pinchGeometry(a, b)
  const t0 = start.transform

  // uniform scale factor, clamped so neither axis leaves [MIN_SCALE, MAX_SCALE]
  let f = g.dist > 0 ? g.dist / start.dist : 1
  const magX = Math.abs(t0.scaleX)
  const magY = Math.abs(t0.scaleY)
  f = Math.min(f, MAX_SCALE / Math.max(magX, magY))
  f = Math.max(f, MIN_SCALE / Math.min(magX, magY))

  const scaleX = t0.scaleX * f
  const scaleY = t0.scaleY * f
  let rotation = t0.rotation + ((g.angle - start.angle) * 180) / Math.PI
  rotation = ((((rotation + 180) % 360) + 360) % 360) - 180 // normalize to (-180, 180]
  const cardinal = Math.round(rotation / 90) * 90
  if (Math.abs(rotation - cardinal) <= ROTATION_SNAP_DEG) {
    rotation = cardinal === -180 ? 180 : cardinal
  }

  // keep the anchor under the (possibly panned) finger midpoint
  const rad = (rotation * Math.PI) / 180
  const sx = start.pivotLocal.x * scaleX
  const sy = start.pivotLocal.y * scaleY
  const rx = sx * Math.cos(rad) - sy * Math.sin(rad)
  const ry = sx * Math.sin(rad) + sy * Math.cos(rad)
  const anchorX = start.pivot.x + (g.mid.x - start.mid.x)
  const anchorY = start.pivot.y + (g.mid.y - start.mid.y)
  return { x: anchorX - rx, y: anchorY - ry, rotation, scaleX, scaleY }
}

/** Where a layer-local point lands in document space. Exposed for tests. */
export function localToDoc(t: Transform, p: TouchPoint): TouchPoint {
  const rad = (t.rotation * Math.PI) / 180
  const sx = p.x * t.scaleX
  const sy = p.y * t.scaleY
  return {
    x: t.x + sx * Math.cos(rad) - sy * Math.sin(rad),
    y: t.y + sx * Math.sin(rad) + sy * Math.cos(rad),
  }
}
