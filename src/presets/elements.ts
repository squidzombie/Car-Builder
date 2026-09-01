import type { Color, Layer } from '../model/types'
import type { Shape } from '../model/shapeTypes'
import { CARD_W, CARD_H, defaultTransform } from '../model/types'
import { makeFinish } from '../finishes/presets'
import { newLayerId } from '../state/editorStore'

// Element preset libraries (Build 5): borders, name plates, badges — more
// default options for every section. Each preset builds fresh layers
// (unique ids) and may carry custom shapes that embed in the document.

export type ElementBuild = { layers: Layer[]; shapes?: Shape[] }
export type ElementPreset = { id: string; name: string; build: () => ElementBuild }

const layer = (partial: Partial<Layer> & Pick<Layer, 'name' | 'type'>): Layer => ({
  id: newLayerId(partial.type),
  transform: defaultTransform(),
  opacity: 1,
  blendMode: 'srcOver',
  locked: false,
  visible: true,
  ...partial,
})

/** Full-card frame: a hollow square stroke inset from the card edge. */
function frame(inset: number, width: number, color: Color, finish?: Layer['finish']): Layer {
  return layer({
    name: 'Border',
    type: 'shape',
    transform: { x: inset, y: inset, rotation: 0, scaleX: 1, scaleY: 1 },
    shape: {
      shapeId: 'square',
      paint: { color: '#00000000' },
      stroke: { color, width },
      w: CARD_W - inset * 2,
      h: CARD_H - inset * 2,
    },
    finish,
  })
}

/** Stamp layer helper. */
function stamps(
  name: string,
  shapeId: string,
  color: Color,
  baseSize: number,
  instances: { x: number; y: number; rotation?: number; scale?: number }[],
  finish?: Layer['finish'],
): Layer {
  return layer({
    name,
    type: 'stamp',
    stamp: {
      shapeId,
      paint: { color },
      baseSize,
      instances: instances.map((i) => ({
        x: i.x,
        y: i.y,
        rotation: i.rotation ?? 0,
        scale: i.scale ?? 1,
      })),
    },
    finish,
  })
}

const edgeRun = (count: number, y: number, margin = 70) => {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    out.push({ x: margin + ((CARD_W - margin * 2) / (count - 1)) * i, y })
  }
  return out
}

const sideRun = (count: number, x: number, margin = 90) => {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    out.push({ x, y: margin + ((CARD_H - margin * 2) / (count - 1)) * i })
  }
  return out
}

const DECO_BRACKET: Shape = {
  id: 'deco-bracket',
  name: 'Deco bracket',
  path: 'M0 0 L1 0 L1 0.18 L0.18 0.18 L0.18 1 L0 1 Z',
  builtIn: false,
}

export const BORDER_PRESETS: ElementPreset[] = [
  { id: 'thin', name: 'Thin', build: () => ({ layers: [frame(22, 8, '#f4f2ec')] }) },
  { id: 'bold', name: 'Bold', build: () => ({ layers: [frame(20, 26, '#f4f2ec')] }) },
  {
    id: 'double',
    name: 'Double',
    build: () => ({ layers: [frame(18, 10, '#f4f2ec'), frame(44, 5, '#f4f2ec')] }),
  },
  {
    id: 'two-tone',
    name: 'Two-tone',
    build: () => ({ layers: [frame(16, 24, '#12355b'), frame(42, 6, '#f1c40f')] }),
  },
  {
    id: 'gold-plate',
    name: 'Gold plate',
    build: () => ({
      layers: [frame(18, 22, '#f1c40f', makeFinish('metallic', 'gold', { intensity: 0.9 }))],
    }),
  },
  {
    id: 'refractor',
    name: 'Refractor',
    build: () => ({
      layers: [frame(18, 14, '#ffffff', makeFinish('spectrum', 'refractor', { intensity: 1 }))],
    }),
  },
  {
    id: 'circles-foil',
    name: 'Circle foil',
    build: () => ({
      layers: [frame(16, 30, '#ffffff', makeFinish('geometric', 'circles', { intensity: 0.9 }))],
    }),
  },
  {
    id: 'corner-studs',
    name: 'Corner studs',
    build: () => ({
      layers: [
        frame(26, 6, '#f4f2ec'),
        stamps('Corner studs', 'diamond', '#f1c40f', 56, [
          { x: 52, y: 52 },
          { x: CARD_W - 52, y: 52 },
          { x: 52, y: CARD_H - 52 },
          { x: CARD_W - 52, y: CARD_H - 52 },
        ]),
      ],
    }),
  },
  {
    id: 'deco-corners',
    name: 'Deco corners',
    build: () => ({
      shapes: [DECO_BRACKET],
      layers: [
        frame(34, 5, '#f4f2ec'),
        stamps('Deco corners', 'deco-bracket', '#f1c40f', 110, [
          { x: 78, y: 78 },
          { x: CARD_W - 78, y: 78, rotation: 90 },
          { x: CARD_W - 78, y: CARD_H - 78, rotation: 180 },
          { x: 78, y: CARD_H - 78, rotation: 270 },
        ]),
      ],
    }),
  },
  {
    id: 'pennant',
    name: 'Pennant edge',
    build: () => ({
      layers: [
        frame(20, 8, '#f4f2ec'),
        stamps('Pennants', 'triangle', '#e63946', 42, [
          ...edgeRun(9, 56).map((p) => ({ ...p, rotation: 180 })),
          ...edgeRun(9, CARD_H - 56),
        ]),
      ],
    }),
  },
  {
    id: 'ticket',
    name: 'Ticket',
    build: () => ({
      layers: [
        frame(24, 10, '#f4f2ec'),
        stamps('Perforations', 'circle', '#0b0e19', 26, [
          ...sideRun(12, 24),
          ...sideRun(12, CARD_W - 24),
        ]),
      ],
    }),
  },
  {
    id: 'stitched',
    name: 'Stitched',
    build: () => ({
      layers: [
        frame(26, 12, '#7c5c3e'),
        stamps('Stitches', 'square', '#f4f2ec', 22, [
          ...edgeRun(14, 26).map((p) => ({ ...p, scale: 0.55 })),
          ...edgeRun(14, CARD_H - 26).map((p) => ({ ...p, scale: 0.55 })),
          ...sideRun(18, 26).map((p) => ({ ...p, rotation: 90, scale: 0.55 })),
          ...sideRun(18, CARD_W - 26).map((p) => ({ ...p, rotation: 90, scale: 0.55 })),
        ]),
      ],
    }),
  },
]

const PILL: Shape = {
  id: 'pill-plate',
  name: 'Pill',
  path: 'M0.12 0 H0.88 Q1 0 1 0.5 Q1 1 0.88 1 H0.12 Q0 1 0 0.5 Q0 0 0.12 0 Z',
  builtIn: false,
}

const CHEVRON_PLATE: Shape = {
  id: 'chevron-plate',
  name: 'Chevron plate',
  path: 'M0.04 0.5 L0.1 0 H0.9 L0.96 0.5 L0.9 1 H0.1 Z',
  builtIn: false,
}

function plate(
  name: string,
  shapeId: string,
  color: Color,
  opts?: { rotation?: number; finish?: Layer['finish']; shapes?: Shape[]; textColor?: Color },
): () => ElementBuild {
  return () => ({
    shapes: opts?.shapes,
    layers: [
      layer({
        name: `${name} plate`,
        type: 'shape',
        transform: {
          x: 95,
          y: 800,
          rotation: opts?.rotation ?? 0,
          scaleX: 1,
          scaleY: 1,
        },
        shape: { shapeId, paint: { color }, w: CARD_W - 190, h: 120 },
        finish: opts?.finish,
      }),
      layer({
        name: 'Name',
        type: 'text',
        transform: {
          x: CARD_W / 2,
          y: 882,
          rotation: opts?.rotation ?? 0,
          scaleX: 1,
          scaleY: 1,
        },
        text: {
          content: 'YOUR NAME',
          font: 'anton',
          size: 62,
          color: opts?.textColor ?? '#0b0e19',
          align: 'c',
        },
      }),
    ],
  })
}

export const PLATE_PRESETS: ElementPreset[] = [
  { id: 'banner', name: 'Banner', build: plate('Banner', 'banner', '#f1c40f', { finish: makeFinish('metallic', 'gold', { intensity: 0.8 }) }) },
  { id: 'bar', name: 'Bar', build: plate('Bar', 'square', '#12355b', { textColor: '#f4f2ec' }) },
  { id: 'skew', name: 'Skewed', build: plate('Skewed', 'square', '#e63946', { rotation: -3, textColor: '#f4f2ec' }) },
  { id: 'pill', name: 'Pill', build: plate('Pill', 'pill-plate', '#f4f2ec', { shapes: [PILL] }) },
  { id: 'chevron', name: 'Chevron', build: plate('Chevron', 'chevron-plate', '#0b1b3a', { shapes: [CHEVRON_PLATE], textColor: '#f1c40f' }) },
  { id: 'chrome-bar', name: 'Chrome', build: plate('Chrome', 'square', '#c9d6ea', { finish: makeFinish('metallic', 'chrome', { intensity: 0.9 }) }) },
]

function badge(
  name: string,
  shapeId: string,
  color: Color,
  opts?: { finish?: Layer['finish']; textColor?: Color; h?: number },
): () => ElementBuild {
  return () => ({
    layers: [
      layer({
        name: `${name} badge`,
        type: 'shape',
        transform: { x: CARD_W - 200, y: 56, rotation: 0, scaleX: 1, scaleY: 1 },
        shape: { shapeId, paint: { color }, w: 140, h: opts?.h ?? 140 },
        finish: opts?.finish,
      }),
      layer({
        name: 'Number',
        type: 'text',
        transform: { x: CARD_W - 130, y: 152, rotation: 0, scaleX: 1, scaleY: 1 },
        text: {
          content: '23',
          font: 'anton',
          size: 64,
          color: opts?.textColor ?? '#ffffff',
          align: 'c',
        },
      }),
    ],
  })
}

export const BADGE_PRESETS: ElementPreset[] = [
  { id: 'circle', name: 'Circle', build: badge('Circle', 'circle', '#8b2131') },
  { id: 'shield', name: 'Shield', build: badge('Shield', 'shield', '#12355b', { h: 160 }) },
  { id: 'star', name: 'Star', build: badge('Star', 'star5', '#f1c40f', { textColor: '#0b0e19' }) },
  { id: 'hex', name: 'Hex', build: badge('Hex', 'hexagon', '#00471b') },
  { id: 'diamond', name: 'Diamond', build: badge('Diamond', 'diamond', '#5a2d81') },
  {
    id: 'gold-star',
    name: 'Gold star',
    build: badge('Gold star', 'star6', '#f1c40f', {
      finish: makeFinish('metallic', 'gold', { intensity: 0.9 }),
      textColor: '#0b0e19',
    }),
  },
]
