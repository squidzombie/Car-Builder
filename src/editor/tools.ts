import type { Point } from '../model/types'

// Pure logic for the M3 draw/stamp tools (CLAUDE.md §4). Symmetry is
// applied at input time — mirrored strokes/instances become real editable
// content, never a render effect.

export type SymmetryMode = 'off' | 'h' | 'v' | 'both'
export const SYMMETRY_ORDER: SymmetryMode[] = ['off', 'h', 'v', 'both']
export const SYMMETRY_LABEL: Record<SymmetryMode, string> = {
  off: 'Sym off',
  h: 'Sym ⇆',
  v: 'Sym ⇅',
  both: 'Sym ⇆⇅',
}

export type SymmetryVariant = {
  /** doc-space point → mirrored doc-space point */
  map: (p: Point) => Point
  /** number of axis flips (1 = mirror image, needs rotation negated) */
  flips: number
}

/** The identity-first list of placements one input point expands into. */
export function symmetryVariants(mode: SymmetryMode, w: number, h: number): SymmetryVariant[] {
  const id: SymmetryVariant = { map: (p) => p, flips: 0 }
  const mh: SymmetryVariant = { map: (p) => ({ x: w - p.x, y: p.y }), flips: 1 }
  const mv: SymmetryVariant = { map: (p) => ({ x: p.x, y: h - p.y }), flips: 1 }
  const mb: SymmetryVariant = { map: (p) => ({ x: w - p.x, y: h - p.y }), flips: 2 }
  switch (mode) {
    case 'h':
      return [id, mh]
    case 'v':
      return [id, mv]
    case 'both':
      return [id, mh, mv, mb]
    default:
      return [id]
  }
}

/** A mirrored copy keeps its handedness by negating rotation per flip. */
export function mirrorRotation(rotation: number, flips: number): number {
  return flips % 2 === 0 ? rotation : -rotation
}

export type RotationMode = 'fixed' | 'random' | 'follow'
export const ROTATION_ORDER: RotationMode[] = ['fixed', 'random', 'follow']
export const ROTATION_LABEL: Record<RotationMode, string> = {
  fixed: 'Rot 0°',
  random: 'Rot rnd',
  follow: 'Rot follow',
}

/** Rotation for a newly placed stamp instance. */
export function stampRotation(
  mode: RotationMode,
  dragAngleDeg: number,
  rand: () => number = Math.random,
): number {
  if (mode === 'random') return rand() * 360
  if (mode === 'follow') return dragAngleDeg
  return 0
}

/** True when p is within reach of the polyline (eraser hit test). */
export function polylineNear(points: Point[], p: Point, reach: number): boolean {
  if (points.length === 0) return false
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y) <= reach
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const len2 = vx * vx + vy * vy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2))
    if (Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t)) <= reach) return true
  }
  return false
}

/** Position/scale wobble for jittered stamping. */
export function jitterInstance(
  p: Point,
  size: number,
  rand: () => number = Math.random,
): { x: number; y: number; scaleMul: number } {
  return {
    x: p.x + (rand() - 0.5) * size * 0.3,
    y: p.y + (rand() - 0.5) * size * 0.3,
    scaleMul: 0.85 + rand() * 0.3,
  }
}
