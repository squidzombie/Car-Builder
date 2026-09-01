import type { CardDocument } from '../model/types'
import { CARD_W, CARD_H, DEFAULT_CORNER_RADIUS } from '../model/types'
import { backLayer as layer, makeStandardBack } from './backs'

// Template 5 (Build 5): Retro — cream stock, two-tone frame, pennant
// edge, skewed bar plate. Vintage set energy.

export function retroCard(id: string, now = new Date().toISOString()): CardDocument {
  return {
    id,
    version: 1,
    size: { w: CARD_W, h: CARD_H },
    cornerRadius: DEFAULT_CORNER_RADIUS,
    palette: { pinned: ['#efe6d0', '#12355b', '#e63946', '#f1c40f'], recents: [] },
    front: {
      layers: [
        layer({
          id: 'bg',
          name: 'Background',
          type: 'fill',
          fill: { paint: { color: '#efe6d0' } },
        }),
        layer({
          id: 'photo',
          name: 'Photo',
          type: 'image',
          transform: { x: 70, y: 120, rotation: 0, scaleX: 1, scaleY: 1 },
          image: { assetId: 'placeholder', cutout: 'none', w: CARD_W - 140, h: 620 },
        }),
        layer({
          id: 'photo-frame',
          name: 'Photo frame',
          type: 'shape',
          transform: { x: 62, y: 112, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: {
            shapeId: 'square',
            paint: { color: '#00000000' },
            stroke: { color: '#12355b', width: 12 },
            w: CARD_W - 124,
            h: 636,
          },
        }),
        layer({
          id: 'pennants',
          name: 'Pennants',
          type: 'stamp',
          stamp: {
            shapeId: 'triangle',
            paint: { color: '#e63946' },
            baseSize: 40,
            instances: Array.from({ length: 8 }, (_, i) => ({
              x: 96 + ((CARD_W - 192) / 7) * i,
              y: 62,
              rotation: 180,
              scale: 1,
            })),
          },
        }),
        layer({
          id: 'plate',
          name: 'Name plate',
          type: 'shape',
          transform: { x: 95, y: 800, rotation: -2, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'square', paint: { color: '#12355b' }, w: CARD_W - 190, h: 120 },
        }),
        layer({
          id: 'name',
          name: 'Name',
          type: 'text',
          transform: { x: CARD_W / 2, y: 882, rotation: -2, scaleX: 1, scaleY: 1 },
          text: { content: 'YOUR NAME', font: 'bebas', size: 66, color: '#efe6d0', align: 'c' },
        }),
        layer({
          id: 'position',
          name: 'Position',
          type: 'text',
          transform: { x: CARD_W / 2, y: 990, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'ALL-TIME GREAT', font: 'marker', size: 40, color: '#e63946', align: 'c' },
        }),
        layer({
          id: 'border',
          name: 'Border',
          type: 'shape',
          transform: { x: 16, y: 16, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: {
            shapeId: 'square',
            paint: { color: '#00000000' },
            stroke: { color: '#12355b', width: 18 },
            w: CARD_W - 32,
            h: CARD_H - 32,
          },
        }),
      ],
    },
    back: makeStandardBack({
      bg: '#efe6d0',
      panel: '#e2d5b8',
      accent: '#12355b',
      text: '#3a3427',
    }),
    meta: { title: 'Retro', templateId: 'retro', createdAt: now, updatedAt: now },
  }
}
