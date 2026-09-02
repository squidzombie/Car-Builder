import type { Shape } from './shapeTypes'

export type { Shape }

const fmt = (n: number) => Number(n.toFixed(4))

/**
 * Build a regular polygon (or star, with insetRatio < 1) as a normalized
 * SVG path in the 0..1 box. This is the custom polygon builder (CLAUDE.md §4):
 * sides 3..24, optional star inset ratio, optional corner rounding.
 */
export function buildPolygonPath(opts: {
  sides: number
  insetRatio?: number // 0..1; <1 makes a star with this inner/outer radius ratio
  cornerRadius?: number // 0..0.5 in normalized units; rounds every vertex
}): string {
  const sides = Math.max(3, Math.min(24, Math.round(opts.sides)))
  const inset = opts.insetRatio !== undefined ? Math.max(0.05, Math.min(1, opts.insetRatio)) : 1
  const round = Math.max(0, Math.min(0.5, opts.cornerRadius ?? 0))

  const pts: { x: number; y: number }[] = []
  const n = inset < 1 ? sides * 2 : sides
  for (let i = 0; i < n; i++) {
    const r = inset < 1 && i % 2 === 1 ? 0.5 * inset : 0.5
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    pts.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) })
  }

  if (round === 0) {
    return (
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' ') + ' Z'
    )
  }

  // Rounded corners: trim each vertex by `round` along both edges and join
  // with a quadratic curve through the original vertex.
  const parts: string[] = []
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length]
    const cur = pts[i]
    const next = pts[(i + 1) % pts.length]
    const toPrev = { x: prev.x - cur.x, y: prev.y - cur.y }
    const toNext = { x: next.x - cur.x, y: next.y - cur.y }
    const lenPrev = Math.hypot(toPrev.x, toPrev.y)
    const lenNext = Math.hypot(toNext.x, toNext.y)
    const t = Math.min(round, lenPrev / 2, lenNext / 2)
    const a = { x: cur.x + (toPrev.x / lenPrev) * t, y: cur.y + (toPrev.y / lenPrev) * t }
    const b = { x: cur.x + (toNext.x / lenNext) * t, y: cur.y + (toNext.y / lenNext) * t }
    parts.push(
      `${i === 0 ? `M${fmt(a.x)} ${fmt(a.y)}` : `L${fmt(a.x)} ${fmt(a.y)}`} Q${fmt(cur.x)} ${fmt(cur.y)} ${fmt(b.x)} ${fmt(b.y)}`,
    )
  }
  return parts.join(' ') + ' Z'
}

/**
 * Turn free-drawn strokes into a custom Shape path (the "Draw" tab of the
 * shape builder). Each stroke is smoothed (Catmull-Rom → cubics, matching
 * the renderer's free-draw look) and auto-closed; the union bounding box is
 * normalized to fill the 0..1 box per axis, with the true drawn proportions
 * returned as `aspect` for Shape.defaultAspect. Render with fillRule
 * 'evenodd' so inner strokes cut holes. Null when there isn't enough ink.
 */
export function buildDrawnShapePath(
  strokes: { x: number; y: number }[][],
): { path: string; aspect: number } | null {
  const inked = strokes.filter((s) => s.length >= 2)
  if (inked.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of inked) {
    for (const p of s) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  const w = maxX - minX
  const h = maxY - minY
  const span = Math.max(w, h)
  if (span < 1e-6) return null
  // a nearly-1D drawing still gets a sliver of thickness
  const nw = Math.max(w, span * 0.02)
  const nh = Math.max(h, span * 0.02)

  const parts: string[] = []
  for (const s of inked) {
    // thin dense move-event points; keep endpoints
    const pts: { x: number; y: number }[] = [s[0]]
    for (let i = 1; i < s.length - 1; i++) {
      const last = pts[pts.length - 1]
      if (Math.hypot(s[i].x - last.x, s[i].y - last.y) >= span * 0.01) pts.push(s[i])
    }
    if (s.length > 1) pts.push(s[s.length - 1])
    const n = pts.map((p) => ({ x: (p.x - minX) / nw, y: (p.y - minY) / nh }))

    if (n.length < 3) {
      parts.push(`M${fmt(n[0].x)} ${fmt(n[0].y)} L${fmt(n[n.length - 1].x)} ${fmt(n[n.length - 1].y)} Z`)
      continue
    }
    let d = `M${fmt(n[0].x)} ${fmt(n[0].y)}`
    for (let i = 0; i < n.length - 1; i++) {
      const p0 = n[Math.max(0, i - 1)]
      const p1 = n[i]
      const p2 = n[i + 1]
      const p3 = n[Math.min(n.length - 1, i + 2)]
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
      d += ` C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p2.x)} ${fmt(p2.y)}`
    }
    parts.push(d + ' Z')
  }

  const aspect = Math.max(0.1, Math.min(10, nw / nh))
  return { path: parts.join(' '), aspect }
}

// Built-in shape library (CLAUDE.md §4). All paths are normalized to the 0..1 box.
export const BUILTIN_SHAPES: Shape[] = [
  {
    id: 'circle',
    name: 'Circle',
    path: 'M0.5 0 A0.5 0.5 0 1 1 0.5 1 A0.5 0.5 0 1 1 0.5 0 Z',
    builtIn: true,
  },
  { id: 'square', name: 'Square', path: 'M0 0 L1 0 L1 1 L0 1 Z', builtIn: true },
  {
    id: 'rect',
    name: 'Rectangle',
    path: 'M0 0 L1 0 L1 1 L0 1 Z',
    builtIn: true,
    defaultAspect: 1.6,
  },
  {
    id: 'rounded',
    name: 'Rounded',
    path: 'M0.16 0 L0.84 0 Q1 0 1 0.16 L1 0.84 Q1 1 0.84 1 L0.16 1 Q0 1 0 0.84 L0 0.16 Q0 0 0.16 0 Z',
    builtIn: true,
  },
  { id: 'triangle', name: 'Triangle', path: buildPolygonPath({ sides: 3 }), builtIn: true },
  {
    id: 'star5',
    name: 'Star (5)',
    path: buildPolygonPath({ sides: 5, insetRatio: 0.45 }),
    builtIn: true,
  },
  {
    id: 'star6',
    name: 'Star (6)',
    path: buildPolygonPath({ sides: 6, insetRatio: 0.55 }),
    builtIn: true,
  },
  { id: 'hexagon', name: 'Hexagon', path: buildPolygonPath({ sides: 6 }), builtIn: true },
  { id: 'diamond', name: 'Diamond', path: 'M0.5 0 L1 0.5 L0.5 1 L0 0.5 Z', builtIn: true },
  {
    id: 'shield',
    name: 'Shield',
    path: 'M0.5 0 L0.95 0.12 L0.95 0.55 Q0.95 0.85 0.5 1 Q0.05 0.85 0.05 0.55 L0.05 0.12 Z',
    builtIn: true,
  },
  {
    id: 'banner',
    name: 'Banner',
    path: 'M0 0.2 L1 0.2 L1 0.8 L0.5 0.65 L0 0.8 Z',
    builtIn: true,
  },
  {
    id: 'lightning',
    name: 'Lightning',
    path: 'M0.62 0 L0.2 0.55 L0.45 0.55 L0.35 1 L0.8 0.42 L0.55 0.42 Z',
    builtIn: true,
  },
  {
    id: 'flame',
    name: 'Flame',
    path: 'M0.5 0 Q0.85 0.3 0.8 0.6 Q0.78 0.85 0.5 1 Q0.22 0.85 0.2 0.6 Q0.18 0.4 0.35 0.22 Q0.32 0.45 0.45 0.5 Q0.4 0.2 0.5 0 Z',
    builtIn: true,
  },
  {
    id: 'crown',
    name: 'Crown',
    path: 'M0.05 0.3 L0.25 0.55 L0.5 0.15 L0.75 0.55 L0.95 0.3 L0.88 0.85 L0.12 0.85 Z',
    builtIn: true,
  },
  {
    id: 'wing',
    name: 'Wing',
    path: 'M0 0.5 Q0.2 0.05 1 0 Q0.75 0.2 0.55 0.3 Q0.8 0.3 0.95 0.28 Q0.7 0.5 0.45 0.55 Q0.65 0.58 0.8 0.55 Q0.5 0.8 0.2 0.75 Q0.05 0.7 0 0.5 Z',
    builtIn: true,
  },
  {
    id: 'laurel',
    name: 'Laurel',
    path: 'M0.5 0.95 Q0.1 0.85 0.08 0.4 Q0.2 0.55 0.3 0.55 Q0.15 0.4 0.18 0.15 Q0.3 0.35 0.4 0.38 Q0.3 0.15 0.4 0 Q0.5 0.2 0.5 0.4 Q0.5 0.2 0.6 0 Q0.7 0.15 0.6 0.38 Q0.7 0.35 0.82 0.15 Q0.85 0.4 0.7 0.55 Q0.8 0.55 0.92 0.4 Q0.9 0.85 0.5 0.95 Z',
    builtIn: true,
  },
]

const byId = new Map(BUILTIN_SHAPES.map((s) => [s.id, s]))

export function getShape(id: string, userShapes?: Shape[]): Shape | undefined {
  return byId.get(id) ?? userShapes?.find((s) => s.id === id)
}
