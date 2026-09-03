import { describe, test, expect } from '@jest/globals'
import { injectPhoto } from '../photo'
import { portraitCard } from '../portrait'
import { blankCard } from '../blank'

describe('injectPhoto (photo-first quick flow)', () => {
  const photo = { assetId: 'asset-abc', w: 1200, h: 1600, cutout: false }

  test('fills a template photo slot, keeping the slot frame', () => {
    const doc = injectPhoto(portraitCard('p'), photo)
    const slot = doc.front.layers.find((l) => l.id === 'photo')!
    expect(slot.image?.assetId).toBe('asset-abc')
    expect(slot.image?.cutout).toBe('none')
    // the frame is the template's, not the photo's pixel size
    expect(slot.image?.w).not.toBe(1200)
    expect(doc.front.layers.some((l) => l.image?.assetId === 'placeholder')).toBe(false)
  })

  test('marks lifted subjects as cutouts', () => {
    const doc = injectPhoto(portraitCard('p'), { ...photo, cutout: true })
    expect(doc.front.layers.find((l) => l.id === 'photo')!.image?.cutout).toBe('subject')
  })

  test('adds a photo layer above the background when there is no slot', () => {
    const doc = injectPhoto(blankCard('b'), photo)
    const idx = doc.front.layers.findIndex((l) => l.type === 'image')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(doc.front.layers[idx].image?.assetId).toBe('asset-abc')
    if (doc.front.layers[0].type === 'fill') expect(idx).toBe(1)
  })
})
