import { useEffect, useState } from 'react'
import { Skia, type SkImage } from '@shopify/react-native-skia'
import type { CardDocument } from '../model/types'
import { getAssetUri } from '../model/assets'

// Decode the SkImages a document references (image layers + raster
// masks). Decoded images are cached for the app session; the returned
// record only ever contains ready images — missing ones render the
// placeholder until their decode lands and triggers a re-render.

const cache = new Map<string, SkImage>()

function collectIds(doc: CardDocument): string[] {
  const ids: string[] = []
  for (const side of [doc.front, doc.back]) {
    for (const l of side.layers) {
      if (l.image) ids.push(l.image.assetId)
      if (l.mask?.type === 'raster' && l.mask.assetId) ids.push(l.mask.assetId)
    }
  }
  return [...new Set(ids)]
}

export function useDocImages(doc: CardDocument): Record<string, SkImage> {
  const [, bump] = useState(0)
  const ids = collectIds(doc)
  const key = ids.join(',')

  useEffect(() => {
    let alive = true
    for (const id of ids) {
      if (cache.has(id)) continue
      const uri = getAssetUri(id)
      if (!uri) continue
      Skia.Data.fromURI(uri)
        .then((data) => {
          if (!alive || !data) return
          const img = Skia.Image.MakeImageFromEncoded(data)
          if (img) {
            cache.set(id, img)
            bump((n) => n + 1)
          }
        })
        .catch(() => {})
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const out: Record<string, SkImage> = {}
  for (const id of ids) {
    const img = cache.get(id)
    if (img) out[id] = img
  }
  return out
}
