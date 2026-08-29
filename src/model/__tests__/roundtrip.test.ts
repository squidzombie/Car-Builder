import { describe, test, expect } from '@jest/globals'
import { serializeCard, deserializeCard, CardParseError } from '../serialize'
import { blankCard } from '../../templates/blank'
import { demoCard } from '../../templates/demo'
import { buildPolygonPath, BUILTIN_SHAPES } from '../shapes'

// CLAUDE.md §12: every layer type and finish family must round-trip through
// JSON serialize → deserialize → render identically. The demo template
// contains all six layer types and all five finish families.

const NOW = '2026-01-01T00:00:00.000Z'

describe('CardDocument JSON round-trip', () => {
  test('blank template round-trips identically', () => {
    const doc = blankCard('test-blank', NOW)
    const json = serializeCard(doc)
    const back = deserializeCard(json)
    expect(back).toEqual(doc)
    expect(serializeCard(back)).toBe(json)
  })

  test('demo template (all layer types + finish families) round-trips identically', () => {
    const doc = demoCard(NOW)
    const types = new Set(doc.front.layers.map((l) => l.type))
    for (const t of ['fill', 'image', 'shape', 'path', 'stamp', 'text']) {
      expect(types).toContain(t)
    }
    const families = new Set(
      [...doc.front.layers, ...doc.back.layers].map((l) => l.finish?.family).filter(Boolean),
    )
    for (const f of ['spectrum', 'geometric', 'fluid', 'metallic', 'sparkle']) {
      expect(families).toContain(f)
    }

    const json = serializeCard(doc)
    const back = deserializeCard(json)
    expect(back).toEqual(doc)
    expect(serializeCard(back)).toBe(json)
  })

  test('rejects malformed documents', () => {
    expect(() => deserializeCard('not json')).toThrow(CardParseError)
    expect(() => deserializeCard('{}')).toThrow(CardParseError)
    expect(() => deserializeCard(JSON.stringify({ version: 2 }))).toThrow(CardParseError)
    const doc = demoCard(NOW) as unknown as { front: { layers: { type: string }[] } }
    doc.front.layers[0].type = 'hologram'
    expect(() => deserializeCard(JSON.stringify(doc))).toThrow(CardParseError)
  })

  test('rejects a layer whose payload does not match its type', () => {
    const doc = blankCard('x', NOW)
    const bad = JSON.parse(serializeCard(doc))
    bad.front.layers.push({
      id: 'l1',
      name: 'bad',
      type: 'text',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      opacity: 1,
      blendMode: 'srcOver',
      locked: false,
      visible: true,
      // no `text` payload
    })
    expect(() => deserializeCard(JSON.stringify(bad))).toThrow(CardParseError)
  })
})

describe('shape library', () => {
  test('all built-in shapes have normalized paths', () => {
    for (const s of BUILTIN_SHAPES) {
      expect(s.path).toMatch(/^M/)
      expect(s.path.trim()).toMatch(/Z$/)
      // every coordinate stays inside the 0..1 box
      const nums = s.path.match(/-?\d+(\.\d+)?/g)!.map(Number)
      for (const n of nums) {
        expect(n).toBeGreaterThanOrEqual(-0.001)
        expect(n).toBeLessThanOrEqual(1.001)
      }
    }
  })

  test('polygon builder clamps sides and produces closed paths', () => {
    expect(buildPolygonPath({ sides: 3 })).toMatch(/Z$/)
    expect(buildPolygonPath({ sides: 100 })).toBe(buildPolygonPath({ sides: 24 }))
    expect(buildPolygonPath({ sides: 5, insetRatio: 0.5 })).toMatch(/Z$/)
    expect(buildPolygonPath({ sides: 6, cornerRadius: 0.1 })).toContain('Q')
  })
})
