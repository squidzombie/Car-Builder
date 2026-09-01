import { describe, test, expect } from '@jest/globals'
import { BADGE_PRESETS, BORDER_PRESETS, PLATE_PRESETS } from '../elements'
import { blankCard } from '../../templates/blank'
import { serializeCard, deserializeCard } from '../../model/serialize'
import { getShape } from '../../model/shapes'

describe('element presets (Build 5)', () => {
  const ALL = [...BORDER_PRESETS, ...PLATE_PRESETS, ...BADGE_PRESETS]

  test('library sizes', () => {
    expect(BORDER_PRESETS.length).toBeGreaterThanOrEqual(12)
    expect(PLATE_PRESETS.length).toBeGreaterThanOrEqual(6)
    expect(BADGE_PRESETS.length).toBeGreaterThanOrEqual(6)
  })

  for (const p of ALL) {
    test(`${p.id} builds resolvable layers and round-trips`, () => {
      const built = p.build()
      expect(built.layers.length).toBeGreaterThan(0)
      const ids = built.layers.map((l) => l.id)
      expect(new Set(ids).size).toBe(ids.length)
      // every referenced shape resolves against builtins + carried shapes
      for (const l of built.layers) {
        const refs = [l.shape?.shapeId, l.stamp?.shapeId].filter(Boolean) as string[]
        for (const ref of refs) {
          expect(getShape(ref, built.shapes)).toBeTruthy()
        }
      }
      const doc = blankCard(`el-${p.id}`, '2026-08-31T00:00:00.000Z')
      doc.shapes = built.shapes
      doc.front.layers = built.layers
      expect(deserializeCard(serializeCard(doc))).toEqual(doc)
    })
  }

  test('two builds of the same preset produce distinct layer ids', () => {
    const a = BORDER_PRESETS[0].build()
    const b = BORDER_PRESETS[0].build()
    expect(a.layers[0].id).not.toBe(b.layers[0].id)
  })
})
