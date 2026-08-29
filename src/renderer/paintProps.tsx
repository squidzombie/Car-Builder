import React from 'react'
import { LinearGradient, RadialGradient, vec } from '@shopify/react-native-skia'
import type { Paint } from '../model/types'

/**
 * Render a Paint as Skia paint children (gradient shaders). For solid colors
 * use paintColor() on the element's `color` prop instead — returns undefined
 * for gradients.
 */
export function paintColor(paint: Paint): string | undefined {
  return 'color' in paint ? paint.color : undefined
}

/** Gradient children for a paint over a w×h box (undefined for solid colors). */
export function PaintChildren({ paint, w, h }: { paint: Paint; w: number; h: number }) {
  if ('color' in paint) return null
  const g = paint.gradient
  const colors = g.stops.map((s) => s.color)
  const positions = g.stops.map((s) => s.offset)
  if (g.type === 'radial') {
    return (
      <RadialGradient
        c={vec((g.cx ?? 0.5) * w, (g.cy ?? 0.5) * h)}
        r={Math.max(w, h) * 0.6}
        colors={colors}
        positions={positions}
      />
    )
  }
  const angle = ((g.angle ?? 90) * Math.PI) / 180
  const cx = w / 2
  const cy = h / 2
  const half = (Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h) / 2
  return (
    <LinearGradient
      start={vec(cx - Math.cos(angle) * half, cy - Math.sin(angle) * half)}
      end={vec(cx + Math.cos(angle) * half, cy + Math.sin(angle) * half)}
      colors={colors}
      positions={positions}
    />
  )
}
