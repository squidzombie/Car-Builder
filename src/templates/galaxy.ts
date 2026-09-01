import type { CardDocument } from '../model/types'
import { CARD_W, CARD_H, DEFAULT_CORNER_RADIUS } from '../model/types'
import { makeFinish } from '../finishes/presets'
import { backLayer as layer, makeStandardBack } from './backs'

// Template 6 (Build 5): Galaxy — aurora depths, starfield sparkle, circle
// foil border. Shows off the new circles pattern.

export function galaxyCard(id: string, now = new Date().toISOString()): CardDocument {
  return {
    id,
    version: 1,
    size: { w: CARD_W, h: CARD_H },
    cornerRadius: DEFAULT_CORNER_RADIUS,
    palette: { pinned: ['#0b0e19', '#5a2d81', '#4da3ff', '#f4f2ec'], recents: [] },
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
                angle: 160,
                stops: [
                  { offset: 0, color: '#0b0e19' },
                  { offset: 1, color: '#221040' },
                ],
              },
            },
          },
          finish: makeFinish('fluid', 'aurora', { intensity: 0.6 }),
        }),
        layer({
          id: 'stars',
          name: 'Stars',
          type: 'fill',
          fill: { paint: { color: '#00000000' } },
          finish: makeFinish('sparkle', 'starfield', { intensity: 0.8 }),
        }),
        layer({
          id: 'photo',
          name: 'Photo',
          type: 'image',
          transform: { x: 60, y: 90, rotation: 0, scaleX: 1, scaleY: 1 },
          image: { assetId: 'placeholder', cutout: 'none', w: CARD_W - 120, h: 640 },
          mask: { type: 'radial-fade', params: { cx: 0.5, cy: 0.45, inner: 0.45, outer: 0.98 } },
        }),
        layer({
          id: 'name',
          name: 'Name',
          type: 'text',
          transform: { x: CARD_W / 2, y: 900, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'YOUR NAME', font: 'audiowide', size: 60, color: '#c9d6ea', align: 'c' },
          finish: makeFinish('metallic', 'chrome', { intensity: 0.9 }),
        }),
        layer({
          id: 'position',
          name: 'Position',
          type: 'text',
          transform: { x: CARD_W / 2, y: 980, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'COSMIC CLASS', font: 'bebas', size: 36, color: '#4da3ff', align: 'c' },
        }),
        layer({
          id: 'border',
          name: 'Circle foil border',
          type: 'shape',
          transform: { x: 18, y: 18, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: {
            shapeId: 'square',
            paint: { color: '#00000000' },
            stroke: { color: '#ffffff', width: 22 },
            w: CARD_W - 36,
            h: CARD_H - 36,
          },
          finish: makeFinish('geometric', 'circles', { intensity: 0.95 }),
        }),
      ],
    },
    back: makeStandardBack({
      bg: '#121030',
      panel: '#1d1650',
      accent: '#4da3ff',
      text: '#e6ecf7',
    }),
    meta: { title: 'Galaxy', templateId: 'galaxy', createdAt: now, updatedAt: now },
  }
}
