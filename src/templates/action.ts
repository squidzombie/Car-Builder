import type { CardDocument } from '../model/types'
import { CARD_W, CARD_H, DEFAULT_CORNER_RADIUS } from '../model/types'
import { makeFinish } from '../finishes/presets'
import { backLayer as layer, makeStandardBack } from './backs'

// Template 4: Action (CLAUDE.md §8) — photo with a linear fade, angled
// team-color stripes, foil name plate.

export function actionCard(id: string, now = new Date().toISOString()): CardDocument {
  return {
    id,
    version: 1,
    size: { w: CARD_W, h: CARD_H },
    cornerRadius: DEFAULT_CORNER_RADIUS,
    palette: { pinned: ['#98002e', '#f9a01b', '#000000', '#ffffff'], recents: [] },
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
                angle: 120,
                stops: [
                  { offset: 0, color: '#1c060e' },
                  { offset: 1, color: '#3a0417' },
                ],
              },
            },
          },
        }),
        layer({
          id: 'stripe-1',
          name: 'Stripe 1',
          type: 'shape',
          transform: { x: -160, y: 640, rotation: -24, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'square', paint: { color: '#98002e' }, w: 1200, h: 170 },
          finish: makeFinish('spectrum', 'wave-refractor', { intensity: 0.6 }),
        }),
        layer({
          id: 'stripe-2',
          name: 'Stripe 2',
          type: 'shape',
          transform: { x: -120, y: 830, rotation: -24, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'square', paint: { color: '#f9a01b' }, w: 1200, h: 90 },
        }),
        layer({
          id: 'photo',
          name: 'Photo',
          type: 'image',
          transform: { x: 30, y: 30, rotation: 0, scaleX: 1, scaleY: 1 },
          image: { assetId: 'placeholder', cutout: 'none', w: CARD_W - 60, h: CARD_H * 0.62 },
          mask: { type: 'linear-fade', params: { angle: 90, start: 0.55, end: 0.92 } },
        }),
        layer({
          id: 'plate',
          name: 'Name plate',
          type: 'shape',
          transform: { x: 95, y: 800, rotation: -3, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'square', paint: { color: '#f9a01b' }, w: CARD_W - 190, h: 130 },
          finish: makeFinish('metallic', 'gold', { intensity: 0.95 }),
        }),
        layer({
          id: 'name',
          name: 'Name',
          type: 'text',
          transform: { x: CARD_W / 2, y: 888, rotation: -3, scaleX: 1, scaleY: 1 },
          text: { content: 'YOUR NAME', font: 'anton', size: 66, color: '#1c060e', align: 'c' },
        }),
        layer({
          id: 'position',
          name: 'Position',
          type: 'text',
          transform: { x: CARD_W / 2, y: 1000, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'CENTER • ALL-STAR', font: 'bebas', size: 38, color: '#f4f2ec', align: 'c' },
        }),
      ],
    },
    back: makeStandardBack({
      bg: '#3a0417',
      panel: '#570823',
      accent: '#f9a01b',
      text: '#f4f2ec',
    }),
    meta: { title: 'Action', templateId: 'action', createdAt: now, updatedAt: now },
  }
}
