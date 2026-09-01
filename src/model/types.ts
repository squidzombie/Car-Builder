// Core data model. See CLAUDE.md §3 (data model) and §5 (finish system).
// Everything here serializes to JSON; image assets are referenced by assetId.

import type { Shape } from './shapeTypes'

export type Color = string // #RRGGBB or #RRGGBBAA

export type Gradient = {
  type: 'linear' | 'radial'
  stops: { offset: number; color: Color }[]
  // linear: angle in degrees; radial: cx/cy in 0..1 layer space
  angle?: number
  cx?: number
  cy?: number
}

export type Paint = { color: Color } | { gradient: Gradient }

export type Stroke = { color: Color; width: number }

export type Point = { x: number; y: number }

export type BlendMode =
  | 'srcOver'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'colorDodge'
  | 'plus'

export type Mask = {
  type: 'linear-fade' | 'radial-fade' | 'shape' | 'raster'
  // linear-fade: angle (deg), start, end (0..1 along angle), softness
  // radial-fade: cx, cy (0..1), inner, outer (0..1 radii)
  // shape: shapeId via assetId field
  params: Record<string, number>
  assetId?: string
}

export type FinishFamily = 'spectrum' | 'geometric' | 'fluid' | 'metallic' | 'sparkle'

export type ConditionPreset = 'mint' | 'near-mint' | 'played' | 'heavily-played'

export type Finish = {
  family: FinishFamily
  preset: string // e.g. 'refractor', 'cracked-ice', 'lava'
  intensity: number // 0..1
  scale: number // pattern size multiplier
  paletteMode: 'rainbow' | 'custom'
  customColors?: Color[]
  params: Record<string, number>
}

export type ViewState = {
  tiltX: number // -1..1
  tiltY: number // -1..1
  lightX: number // virtual light position 0..1 across card
  lightY: number
}

export type StampInstance = { x: number; y: number; rotation: number; scale: number }

export type LayerType = 'fill' | 'image' | 'shape' | 'path' | 'stamp' | 'text'

export type Layer = {
  id: string
  name: string
  type: LayerType
  transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }
  opacity: number
  blendMode: BlendMode
  locked: boolean
  visible: boolean
  mask?: Mask
  finish?: Finish
  /** raised/inset ink illusion, lit by the view's light (Build 4) */
  emboss?: { height: number; style: 'raised' | 'inset' }
  // type-specific payloads:
  fill?: { paint: Paint }
  image?: { assetId: string; cutout: 'none' | 'subject' | 'manual'; w: number; h: number }
  shape?: { shapeId: string; paint: Paint; stroke?: Stroke; w: number; h: number }
  // free draw: a draw session's strokes accumulate here, sharing one style
  path?: { strokes: { points: Point[] }[]; stroke: Stroke }
  stamp?: { shapeId: string; instances: StampInstance[]; paint: Paint; baseSize: number }
  text?: {
    content: string
    font: string
    size: number
    color: Color
    align: 'l' | 'c' | 'r'
  }
}

export type Side = { layers: Layer[] } // bottom to top

export type Palette = {
  pinned: Color[]
  recents: Color[]
}

export type CardDocument = {
  id: string
  version: 1
  size: { w: number; h: number } // px at 300dpi; default 750 x 1050
  cornerRadius: number
  palette: Palette
  /** custom shapes used by this card (§4 polygon builder) — travel with it */
  shapes?: Shape[]
  /** simulated card condition — tilt-reactive wear overlay (Build 4) */
  condition?: { preset: ConditionPreset; intensity: number }
  front: Side
  back: Side
  meta: {
    title?: string
    templateId?: string
    createdAt: string
    updatedAt: string
  }
}

export const CARD_W = 750
export const CARD_H = 1050
export const DEFAULT_CORNER_RADIUS = 36

export function defaultTransform(): Layer['transform'] {
  return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
}

export function defaultViewState(): ViewState {
  return { tiltX: 0, tiltY: 0, lightX: 0.5, lightY: 0.3 }
}

/** Derive the virtual light position from tilt (CLAUDE.md §5 ViewState). */
export function lightFromTilt(tiltX: number, tiltY: number): { lightX: number; lightY: number } {
  return {
    lightX: 0.5 + tiltX * 0.45,
    lightY: 0.35 + tiltY * 0.45,
  }
}
