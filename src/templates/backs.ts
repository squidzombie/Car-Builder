import type { Color, Layer, Side } from '../model/types'
import { CARD_W, defaultTransform } from '../model/types'
import { makeFinish } from '../finishes/presets'

// Standard card back (CLAUDE.md §8): logo slot, stats table (5 rows x 4
// cols of editable text-layer cells, header row included), bio block.
// Templates recolor it via bg/accent.

export const backLayer = (
  partial: Partial<Layer> & Pick<Layer, 'id' | 'name' | 'type'>,
): Layer => ({
  transform: defaultTransform(),
  opacity: 1,
  blendMode: 'srcOver',
  locked: false,
  visible: true,
  ...partial,
})

const HEADERS = ['SEASON', 'GP', 'PTS', 'AST']
const SAMPLE_ROWS = [
  ['2022', '68', '18.4', '5.1'],
  ['2023', '75', '22.9', '6.3'],
  ['2024', '80', '27.5', '7.8'],
  ['2025', '82', '31.2', '8.4'],
]

export function makeStandardBack(opts: {
  bg: Color
  panel: Color
  accent: Color
  text: Color
  logoShapeId?: string
}): Side {
  const layers: Layer[] = [
    backLayer({
      id: 'back-bg',
      name: 'Background',
      type: 'fill',
      fill: { paint: { color: opts.bg } },
      finish: makeFinish('geometric', 'mosaic', { intensity: 0.3 }),
    }),
    backLayer({
      id: 'back-logo',
      name: 'Logo',
      type: 'shape',
      transform: { x: CARD_W / 2 - 80, y: 70, rotation: 0, scaleX: 1, scaleY: 1 },
      shape: { shapeId: opts.logoShapeId ?? 'shield', paint: { color: opts.accent }, w: 160, h: 180 },
      finish: makeFinish('metallic', 'gold', { intensity: 0.7 }),
    }),
    backLayer({
      id: 'back-panel',
      name: 'Stats panel',
      type: 'shape',
      transform: { x: 60, y: 300, rotation: 0, scaleX: 1, scaleY: 1 },
      shape: { shapeId: 'square', paint: { color: opts.panel }, w: CARD_W - 120, h: 420 },
      opacity: 0.85,
    }),
  ]

  // stats table: header row + 4 data rows, 4 columns of centered cells
  const tableX = 60
  const tableW = CARD_W - 120
  const colW = tableW / 4
  const rowH = 76
  const tableY = 360
  const rows = [HEADERS, ...SAMPLE_ROWS]
  rows.forEach((cells, r) => {
    cells.forEach((content, c) => {
      layers.push(
        backLayer({
          id: `stat-r${r}c${c}`,
          name: r === 0 ? `Header ${HEADERS[c]}` : `Stat r${r}c${c + 1}`,
          type: 'text',
          transform: {
            x: tableX + colW * (c + 0.5),
            y: tableY + rowH * r,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          text: {
            content,
            font: r === 0 ? 'bebas' : 'system',
            size: r === 0 ? 38 : 34,
            color: r === 0 ? opts.accent : opts.text,
            align: 'c',
          },
        }),
      )
    })
  })

  layers.push(
    backLayer({
      id: 'back-bio-1',
      name: 'Bio line 1',
      type: 'text',
      transform: { x: CARD_W / 2, y: 830, rotation: 0, scaleX: 1, scaleY: 1 },
      text: {
        content: 'DRAFTED IN THE FIRST ROUND.',
        font: 'system',
        size: 30,
        color: opts.text,
        align: 'c',
      },
    }),
    backLayer({
      id: 'back-bio-2',
      name: 'Bio line 2',
      type: 'text',
      transform: { x: CARD_W / 2, y: 880, rotation: 0, scaleX: 1, scaleY: 1 },
      text: {
        content: 'KNOWN FOR CLUTCH FOURTH QUARTERS.',
        font: 'system',
        size: 30,
        color: opts.text,
        align: 'c',
      },
    }),
    backLayer({
      id: 'back-number',
      name: 'Card number',
      type: 'text',
      transform: { x: CARD_W / 2, y: 990, rotation: 0, scaleX: 1, scaleY: 1 },
      text: { content: 'NO. 23 / 99', font: 'bebas', size: 34, color: opts.accent, align: 'c' },
      // serial numbers print with visibly raised ink (Build 4 emboss)
      emboss: { height: 0.55, style: 'raised' },
    }),
  )

  return { layers }
}
