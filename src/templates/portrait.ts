import type { CardDocument } from '../model/types'
import { CARD_W, CARD_H, DEFAULT_CORNER_RADIUS } from '../model/types'
import { makeFinish } from '../finishes/presets'
import { backLayer as layer, makeStandardBack } from './backs'
import { ARCH_FRAME } from '../presets/elements'

// Template 2: Portrait (CLAUDE.md §8) — photo slot upper 70% with a
// radial fade at the bottom, name bar, number badge, refractor border.

export function portraitCard(id: string, now = new Date().toISOString()): CardDocument {
  return {
    id,
    version: 1,
    size: { w: CARD_W, h: CARD_H },
    cornerRadius: DEFAULT_CORNER_RADIUS,
    palette: { pinned: ['#0e2240', '#fec524', '#ffffff', '#8b2131'], recents: [] },
    front: {
      layers: [
        layer({
          id: 'bg',
          name: 'Background',
          type: 'fill',
          fill: {
            paint: {
              gradient: {
                type: 'linear',
                angle: 100,
                stops: [
                  { offset: 0, color: '#0e2240' },
                  { offset: 1, color: '#1b3a66' },
                ],
              },
            },
          },
        }),
        layer({
          id: 'photo',
          name: 'Photo',
          type: 'image',
          transform: { x: 40, y: 40, rotation: 0, scaleX: 1, scaleY: 1 },
          image: { assetId: 'placeholder', cutout: 'none', w: CARD_W - 80, h: CARD_H * 0.7 },
          mask: { type: 'radial-fade', params: { cx: 0.5, cy: 0.32, inner: 0.5, outer: 0.95 } },
        }),
        layer({
          id: 'name-bar',
          name: 'Name bar',
          type: 'shape',
          transform: { x: 60, y: 810, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'banner', paint: { color: '#fec524' }, w: CARD_W - 120, h: 120 },
          finish: makeFinish('metallic', 'gold', { intensity: 0.8 }),
        }),
        layer({
          id: 'name',
          name: 'Name',
          type: 'text',
          transform: { x: CARD_W / 2, y: 890, rotation: 0, scaleX: 1, scaleY: 1 },
          text: {
            content: 'YOUR NAME',
            font: 'anton',
            size: 64,
            color: '#0e2240',
            align: 'c',
            shadow: { color: '#00000060', dx: 0, dy: 3, blur: 5 },
          },
        }),
        layer({
          id: 'badge',
          name: 'Number badge',
          type: 'shape',
          transform: { x: CARD_W - 190, y: 60, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'circle', paint: { color: '#8b2131' }, w: 130, h: 130 },
        }),
        layer({
          id: 'number',
          name: 'Number',
          type: 'text',
          transform: { x: CARD_W - 125, y: 148, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: '23', font: 'anton', size: 64, color: '#ffffff', align: 'c' },
        }),
        layer({
          id: 'position',
          name: 'Position',
          type: 'text',
          transform: { x: CARD_W / 2, y: 990, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'GUARD • ROOKIE', font: 'bebas', size: 40, color: '#c9d6ea', align: 'c' },
        }),
        // arched refractor frame: a domed window over the portrait
        layer({
          id: 'border',
          name: 'Arch frame',
          type: 'shape',
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: { shapeId: ARCH_FRAME.id, paint: { color: '#ffffff' }, w: CARD_W, h: CARD_H },
          finish: makeFinish('spectrum', 'refractor', { intensity: 1 }),
        }),
      ],
    },
    shapes: [ARCH_FRAME],
    back: makeStandardBack({
      bg: '#0e2240',
      panel: '#132f56',
      accent: '#fec524',
      text: '#e6ecf7',
    }),
    meta: { title: 'Portrait', templateId: 'portrait', createdAt: now, updatedAt: now },
  }
}
