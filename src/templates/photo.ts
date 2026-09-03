import type { CardDocument } from '../model/types'
import { makeImageLayer } from '../state/editorStore'

// Photo-first quick flow: drop a picked photo into a template. Templates
// mark their photo slot with assetId 'placeholder'; every such slot gets
// the photo (frame size stays the template's, the photo cover-fits it).
// A template without a slot (Blank) gets a fresh photo layer above its
// background instead.

export type PhotoPick = {
  assetId: string
  w: number
  h: number
  /** true when the asset is a lifted subject (transparent background) */
  cutout: boolean
}

export const PLACEHOLDER_ASSET = 'placeholder'

export function injectPhoto(doc: CardDocument, photo: PhotoPick): CardDocument {
  let replaced = false
  const layers = doc.front.layers.map((l) => {
    if (l.type === 'image' && l.image?.assetId === PLACEHOLDER_ASSET) {
      replaced = true
      return {
        ...l,
        image: { ...l.image, assetId: photo.assetId, cutout: photo.cutout ? 'subject' : 'none' },
      } as typeof l
    }
    return l
  })
  if (!replaced) {
    const photoLayer = makeImageLayer(photo.assetId, photo.w, photo.h)
    if (photo.cutout) photoLayer.image!.cutout = 'subject'
    // above the background fill (index 0) when there is one
    const at = layers.length > 0 && layers[0].type === 'fill' ? 1 : 0
    layers.splice(at, 0, photoLayer)
  }
  return { ...doc, front: { layers } }
}
