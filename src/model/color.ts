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

/** r/g/b/a floats 0..1 → #rrggbb, or #rrggbbaa when alpha < 1. */
export function rgbaToHex(r: number, g: number, b: number, a = 1): Color {
  const to = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  const base = `#${to(r)}${to(g)}${to(b)}`
  return Math.round(Math.max(0, Math.min(1, a)) * 255) === 255 ? base : base + to(a)
}

// HSV color space for the picker (§6): h 0..360, s/v/a 0..1.
export type Hsva = { h: number; s: number; v: number; a: number }

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const m = v - c
  return [r + m, g + m, b + m]
}

export function hexToHsva(color: Color): Hsva {
  const [r, g, b, a] = parseColor(color)
  return { ...rgbToHsv(r, g, b), a }
}

export function hsvaToHex({ h, s, v, a }: Hsva): Color {
  const [r, g, b] = hsvToRgb(h, s, v)
  return rgbaToHex(r, g, b, a)
}

/** Accepts user hex input with or without '#': 3, 6, or 8 digits. */
export function isValidHexInput(text: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(text.trim())
}

/** Normalize valid user hex input to canonical lowercase #rrggbb(aa). */
export function normalizeHexInput(text: string): Color {
  const [r, g, b, a] = parseColor(text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`)
  return rgbaToHex(r, g, b, a)
}
