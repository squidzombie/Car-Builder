import type { CardDocument } from '../model/types'
import { CARD_W, CARD_H, DEFAULT_CORNER_RADIUS } from '../model/types'

/** Template 1: Blank — white card, no layers (CLAUDE.md §8). */
export function blankCard(id: string, now = new Date().toISOString()): CardDocument {
  return {
    id,
    version: 1,
    size: { w: CARD_W, h: CARD_H },
    cornerRadius: DEFAULT_CORNER_RADIUS,
    palette: { pinned: [], recents: [] },
    front: { layers: [] },
    back: { layers: [] },
    meta: { templateId: 'blank', createdAt: now, updatedAt: now },
  }
}
