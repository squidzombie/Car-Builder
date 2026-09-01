import { describe, test, expect } from '@jest/globals'
import { TEMPLATES } from '../index'
import { serializeCard, deserializeCard } from '../../model/serialize'

describe('templates (§8)', () => {
  test('the template registry is complete', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([
      'blank',
      'portrait',
      'full-body',
      'action',
      'retro',
      'galaxy',
    ])
  })

  for (const t of TEMPLATES) {
    test(`${t.id} round-trips through JSON and has a well-formed back`, () => {
      const doc = t.make(`test-${t.id}`, '2026-08-31T00:00:00.000Z')
      expect(deserializeCard(serializeCard(doc))).toEqual(doc)
      expect(doc.meta.templateId).toBe(t.id)
      if (t.id !== 'blank') {
        // §8: every template defines a back with a 5x4 stats table
        const statCells = doc.back.layers.filter((l) => l.id.startsWith('stat-'))
        expect(statCells).toHaveLength(20)
        expect(doc.back.layers.some((l) => l.id === 'back-logo')).toBe(true)
        expect(doc.back.layers.some((l) => l.id.startsWith('back-bio'))).toBe(true)
        expect(doc.front.layers.length).toBeGreaterThan(3)
      }
    })
  }

  test('layer ids are unique within each side', () => {
    for (const t of TEMPLATES) {
      const doc = t.make(`uniq-${t.id}`)
      for (const side of [doc.front, doc.back]) {
        const ids = side.layers.map((l) => l.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })
})
