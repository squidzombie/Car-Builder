import type { Color } from './types'

/** Parse #RGB, #RRGGBB or #RRGGBBAA into [r,g,b,a] floats 0..1. */
export function parseColor(color: Color): [number, number, number, number] {
  let hex = color.trim().replace(/^#/, '')
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  if (hex.length === 6) hex += 'ff'
  if (hex.length !== 8 || /[^0-9a-fA-F]/.test(hex)) return [1, 0, 1, 1] // magenta = bad color
  const n = parseInt(hex, 16)
  return [
    ((n >>> 24) & 0xff) / 255,
    ((n >>> 16) & 0xff) / 255,
    ((n >>> 8) & 0xff) / 255,
    (n & 0xff) / 255,
  ]
}
