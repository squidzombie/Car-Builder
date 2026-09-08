import { describe, test, expect } from '@jest/globals'
import { serializeCard, deserializeCard } from '../serialize'
import { blankCard } from '../../templates/blank'
import type { Layer } from '../types'

// CLAUDE.md §12: new layer fields must round-trip through JSON identically.

describe('text outline + shadow', () => {
  test('round-trips through serialize/deserialize', () => {
    const doc = blankCard('t', '2026-01-01T00:00:00.000Z')
    const layer: Layer = {
      id: 'txt',
      name: 'Name',
      type: 'text',
      transform: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 },
      opacity: 1,
      blendMode: 'srcOver',
      locked: false,
      visible: true,
      text: {
        content: 'ROOKIE',
        font: 'anton',
        size: 96,
        color: '#ffffff',
        align: 'c',
        outline: { color: '#000000', width: 6 },
        shadow: { color: '#000000a0', dx: 0, dy: 5, blur: 9 },
      },
    }
    doc.front.layers.push(layer)
    const json = serializeCard(doc)
    const back = deserializeCard(json)
    expect(back).toEqual(doc)
    expect(back.front.layers[0].text?.outline).toEqual({ color: '#000000', width: 6 })
    expect(back.front.layers[0].text?.shadow?.blur).toBe(9)
  })
})

describe('text orientation', () => {
  test('stacked orientation round-trips', () => {
    const doc = blankCard('t', '2026-01-01T00:00:00.000Z')
    const layer: Layer = {
      id: 'v',
      name: 'Vertical',
      type: 'text',
      transform: { x: 60, y: 120, rotation: 0, scaleX: 1, scaleY: 1 },
      opacity: 1,
      blendMode: 'srcOver',
      locked: false,
      visible: true,
      text: { content: 'ROOKIE', font: 'bebas', size: 80, color: '#ffffff', align: 'c', orientation: 'v' },
    }
    doc.front.layers.push(layer)
    const back = deserializeCard(serializeCard(doc))
    expect(back).toEqual(doc)
    expect(back.front.layers[0].text?.orientation).toBe('v')
  })
})
