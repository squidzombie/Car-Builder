import { useEffect, useState } from 'react'
import { Skia, type SkImage } from '@shopify/react-native-skia'
import type { CardDocument } from '../model/types'
import { getAssetUri } from '../model/assets'

// Decode the SkImages a document references (image layers + raster
// masks). Decodes are cached for the app session and shared by every
// mounted hook: a decode started by one screen (say, the template
// chooser's previews) lands for all of them, a hook that mounts
// mid-decode is still told when it finishes, and a decode that fails
// (the picker's temp file not readable the instant it lands) retries
// once — so a photo never sits undrawn waiting for an unrelated
// re-render.

const cache = new Map<string, SkImage>()
const inflight = new Set<string>()
const attempts = new Map<string, number>()
const listeners = new Set<() => void>()
const MAX_ATTEMPTS = 2

function notify() {
  for (const l of listeners) l()
}

function decode(id: string): void {
  if (cache.has(id) || inflight.has(id)) return
  // shared documents reference their assets by public URL directly
  const uri = getAssetUri(id) ?? (id.startsWith('http') ? id : undefined)
  if (!uri) return
  const n = (attempts.get(id) ?? 0) + 1
  if (n > MAX_ATTEMPTS) return
  attempts.set(id, n)
  inflight.add(id)
  Skia.Data.fromURI(uri)
    .then((data) => {
      const img = data ? Skia.Image.MakeImageFromEncoded(data) : null
      if (img) cache.set(id, img)
      else throw new Error('decode failed')
    })
    .catch(() => {
      if (n < MAX_ATTEMPTS) setTimeout(() => decode(id), 700)
    })
    .finally(() => {
      inflight.delete(id)
      if (cache.has(id)) notify()
    })
}

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

  // any decode landing anywhere re-renders every consumer
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  useEffect(() => {
    for (const id of ids) {
      if (!cache.has(id)) {
        // an id that failed earlier gets a fresh chance when a document
        // references it again (its URI may have been registered since)
        if ((attempts.get(id) ?? 0) >= MAX_ATTEMPTS && !inflight.has(id)) attempts.delete(id)
        decode(id)
      }
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
