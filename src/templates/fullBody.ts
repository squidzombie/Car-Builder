import type { CardDocument } from '../model/types'
import { CARD_W, CARD_H, DEFAULT_CORNER_RADIUS } from '../model/types'
import { makeFinish } from '../finishes/presets'
import { backLayer as layer, makeStandardBack } from './backs'

// Template 3: Full body (CLAUDE.md §8) — cracked-ice background, diagonal
// color band behind the subject, photo slot marked for subject cutout.

export function fullBodyCard(id: string, now = new Date().toISOString()): CardDocument {
  return {
    id,
    version: 1,
    size: { w: CARD_W, h: CARD_H },
    cornerRadius: DEFAULT_CORNER_RADIUS,
    palette: { pinned: ['#00471b', '#eee1c6', '#7ab648', '#ffffff'], recents: [] },
    front: {
      layers: [
        layer({
          id: 'bg',
          name: 'Background',
          type: 'fill',
          fill: { paint: { color: '#00471b' } },
          finish: makeFinish('geometric', 'cracked-ice', { intensity: 0.55 }),
        }),
        layer({
          id: 'band',
          name: 'Color band',
          type: 'shape',
          transform: { x: -140, y: 330, rotation: -18, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'square', paint: { color: '#7ab648' }, w: 1150, h: 300 },
          opacity: 0.9,
          finish: makeFinish('spectrum', 'rainbow', { intensity: 0.4 }),
        }),
        layer({
          id: 'photo',
          name: 'Photo (cutout)',
          type: 'image',
          transform: { x: 95, y: 80, rotation: 0, scaleX: 1, scaleY: 1 },
          image: { assetId: 'placeholder', cutout: 'subject', w: CARD_W - 190, h: CARD_H - 300 },
        }),
        layer({
          id: 'name',
          name: 'Name',
          type: 'text',
          transform: { x: CARD_W / 2, y: 950, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'YOUR NAME', font: 'anton', size: 88, color: '#eee1c6', align: 'c' },
          finish: makeFinish('metallic', 'gold', { intensity: 0.85 }),
        }),
        layer({
          id: 'position',
          name: 'Position',
          type: 'text',
          transform: { x: CARD_W / 2, y: 1010, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'FORWARD', font: 'bebas', size: 38, color: '#ffffff', align: 'c' },
        }),
      ],
    },
    back: makeStandardBack({
      bg: '#00471b',
      panel: '#0c5c2b',
      accent: '#eee1c6',
      text: '#f4f2ec',
    }),
    meta: { title: 'Full body', templateId: 'full-body', createdAt: now, updatedAt: now },
  }
}
