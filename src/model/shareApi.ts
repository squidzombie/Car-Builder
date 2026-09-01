import * as FileSystem from 'expo-file-system/legacy'
import type { CardDocument } from './types'
import { serializeCard } from './serialize'
import { getAssetUri } from './assets'
import { SUPABASE_ANON_KEY, SUPABASE_URL, VIEWER_URL } from './shareConfig'

// Share-link upload (M6, §9): the card JSON + its image assets go to the
// public Supabase "cards" bucket under an unlisted random id. Image
// layers in the uploaded copy reference their public URLs, so the web
// viewer needs no asset registry.

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function randomShareId(len = 10): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  }
  return out
}

const headers = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
})

async function uploadObject(path: string, body: string | Blob, contentType: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/cards/${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': contentType, 'x-upsert': 'true' },
    body,
  })
  if (!res.ok) throw new Error(`upload failed (${res.status}): ${await res.text()}`)
}

const publicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/cards/${path}`

/**
 * Upload the card + assets; returns the share link (or the raw JSON URL
 * until a viewer host is configured).
 */
export async function uploadCard(doc: CardDocument): Promise<{ shareId: string; link: string }> {
  const shareId = randomShareId()
  const copy: CardDocument = JSON.parse(serializeCard(doc))

  // upload each referenced image asset and point the copy at public URLs
  for (const side of [copy.front, copy.back]) {
    for (const layer of side.layers) {
      if (!layer.image) continue
      const uri = getAssetUri(layer.image.assetId)
      if (!uri || layer.image.assetId.startsWith('http')) continue
      const ext = uri.includes('.png') ? 'png' : 'jpg'
      const assetPath = `assets/${shareId}-${layer.image.assetId}.${ext}`
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      await uploadObject(
        assetPath,
        new Blob([bytes], { type: `image/${ext === 'png' ? 'png' : 'jpeg'}` }),
        `image/${ext === 'png' ? 'png' : 'jpeg'}`,
      )
      layer.image.assetId = publicUrl(assetPath)
    }
  }

  await uploadObject(`${shareId}.json`, serializeCard(copy), 'application/json')
  const link = VIEWER_URL ? `${VIEWER_URL}/c/${shareId}` : publicUrl(`${shareId}.json`)
  return { shareId, link }
}
