import type { CardDocument, Layer } from '../model/types'
import { CARD_W, CARD_H, DEFAULT_CORNER_RADIUS, defaultTransform } from '../model/types'
import { makeFinish } from '../finishes/presets'

// Hand-written M1 checkpoint template: exercises every layer type and the
// five bold finishes, so loading it and tilting proves the whole pipeline.

const layer = (partial: Partial<Layer> & Pick<Layer, 'id' | 'name' | 'type'>): Layer => ({
  transform: defaultTransform(),
  opacity: 1,
  blendMode: 'srcOver',
  locked: false,
  visible: true,
  ...partial,
})

export function demoCard(now = new Date().toISOString()): CardDocument {
  return {
    id: 'demo-card',
    version: 1,
    size: { w: CARD_W, h: CARD_H },
    cornerRadius: DEFAULT_CORNER_RADIUS,
    palette: {
      pinned: ['#0b1b3a', '#e63946', '#f1c40f', '#2ec4b6'],
      recents: [],
    },
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
                angle: 115,
                stops: [
                  { offset: 0, color: '#0b1b3a' },
                  { offset: 1, color: '#12355b' },
                ],
              },
            },
          },
          finish: makeFinish('geometric', 'cracked-ice', { intensity: 0.5 }),
        }),
        layer({
          id: 'band',
          name: 'Color band',
          type: 'shape',
          transform: { x: -220, y: 430, rotation: -18, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'square', paint: { color: '#e63946' }, w: 1200, h: 240 },
          finish: makeFinish('fluid', 'lava', { intensity: 0.75 }),
        }),
        layer({
          id: 'photo',
          name: 'Photo slot',
          type: 'image',
          transform: { x: 115, y: 90, rotation: 0, scaleX: 1, scaleY: 1 },
          image: { assetId: 'demo-photo', cutout: 'none', w: 520, h: 560 },
          mask: { type: 'radial-fade', params: { cx: 0.5, cy: 0.42, inner: 0.35, outer: 0.75 } },
        }),
        layer({
          id: 'shield',
          name: 'Badge',
          type: 'shape',
          transform: { x: 570, y: 60, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: { shapeId: 'shield', paint: { color: '#f1c40f' }, w: 130, h: 150, stroke: { color: '#0b1b3a', width: 6 } },
          finish: makeFinish('metallic', 'gold', { intensity: 0.9 }),
        }),
        layer({
          id: 'stars',
          name: 'Star stamps',
          type: 'stamp',
          stamp: {
            shapeId: 'star5',
            baseSize: 60,
            paint: { color: '#ffffff' },
            instances: [
              { x: 90, y: 760, rotation: 0, scale: 1 },
              { x: 170, y: 810, rotation: 18, scale: 0.7 },
              { x: 660, y: 740, rotation: -12, scale: 0.9 },
              { x: 610, y: 820, rotation: 30, scale: 0.6 },
            ],
          },
          finish: makeFinish('sparkle', 'glitter', { intensity: 1 }),
        }),
        layer({
          id: 'swoosh',
          name: 'Swoosh',
          type: 'path',
          path: {
            strokes: [
              {
                points: [
                  { x: 70, y: 700 },
                  { x: 240, y: 660 },
                  { x: 470, y: 680 },
                  { x: 680, y: 640 },
                ],
              },
            ],
            stroke: { color: '#2ec4b6', width: 14 },
          },
        }),
        layer({
          id: 'name',
          name: 'Name',
          type: 'text',
          transform: { x: CARD_W / 2, y: 930, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'CARD BUILDER', font: 'system', size: 84, color: '#ffffff', align: 'c' },
          finish: makeFinish('spectrum', 'refractor', { intensity: 0.95 }),
        }),
        layer({
          id: 'position',
          name: 'Position',
          type: 'text',
          transform: { x: CARD_W / 2, y: 1000, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'ROOKIE • M1 CHECKPOINT', font: 'system', size: 34, color: '#c9d6ea', align: 'c' },
        }),
        layer({
          id: 'border',
          name: 'Foil border',
          type: 'shape',
          transform: { x: 18, y: 18, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: {
            shapeId: 'square',
            paint: { color: '#00000000' },
            stroke: { color: '#ffffff', width: 14 },
            w: CARD_W - 36,
            h: CARD_H - 36,
          },
          finish: makeFinish('spectrum', 'rainbow', { intensity: 1 }),
        }),
      ],
    },
    back: {
      layers: [
        layer({
          id: 'back-bg',
          name: 'Background',
          type: 'fill',
          fill: { paint: { color: '#12355b' } },
          // deliberately subtle: shows a finish as a quiet full-bleed overlay,
          // the way real card backs shimmer without fighting the text
          finish: makeFinish('geometric', 'mosaic', { intensity: 0.35 }),
        }),
        layer({
          id: 'back-title',
          name: 'Title',
          type: 'text',
          transform: { x: CARD_W / 2, y: 140, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'CAREER STATS', font: 'system', size: 56, color: '#f1c40f', align: 'c' },
          finish: makeFinish('metallic', 'gold', { intensity: 0.8 }),
        }),
        // stats table = text layers arranged in a grid (CLAUDE.md §4)
        ...['YEAR  GP   PTS  AST', '2023  71  18.2  5.1', '2024  78  24.6  6.3', '2025  80  31.9  7.8'].map(
          (row, i) =>
            layer({
              id: `stats-row-${i}`,
              name: `Stats row ${i}`,
              type: 'text',
              transform: { x: CARD_W / 2, y: 320 + i * 90, rotation: 0, scaleX: 1, scaleY: 1 },
              text: { content: row, font: 'system', size: 44, color: i === 0 ? '#8fb3dd' : '#ffffff', align: 'c' },
            }),
        ),
        layer({
          id: 'back-bio',
          name: 'Bio',
          type: 'text',
          transform: { x: CARD_W / 2, y: 780, rotation: 0, scaleX: 1, scaleY: 1 },
          text: { content: 'Built with the Card Builder engine.', font: 'system', size: 36, color: '#c9d6ea', align: 'c' },
        }),
        layer({
          id: 'back-border',
          name: 'Border',
          type: 'shape',
          transform: { x: 18, y: 18, rotation: 0, scaleX: 1, scaleY: 1 },
          shape: {
            shapeId: 'square',
            paint: { color: '#00000000' },
            stroke: { color: '#ffffff', width: 10 },
            w: CARD_W - 36,
            h: CARD_H - 36,
          },
          finish: makeFinish('spectrum', 'refractor', { intensity: 0.8 }),
        }),
      ],
    },
    meta: {
      title: 'Demo Card',
      templateId: 'demo',
      createdAt: now,
      updatedAt: now,
    },
  }
}
