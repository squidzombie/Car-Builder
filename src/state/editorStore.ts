import { create } from 'zustand'
import { produce } from 'immer'
import type { CardDocument, Color, Layer, Paint } from '../model/types'
import { CARD_H, CARD_W, defaultTransform } from '../model/types'
import { getShape } from '../model/shapes'

// Editor state (CLAUDE.md §4): the document plus selection, side, and an
// undo/redo command stack. History is snapshot-based — immer's structural
// sharing makes each entry cheap, and CardDocument is pure JSON so a
// snapshot can never go stale.

export const HISTORY_DEPTH = 50
const MAX_RECENTS = 12

export type SideName = 'front' | 'back'

let idCounter = 0
/** Unique-enough layer id: readable prefix + time + counter. */
export function newLayerId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

export type EditorState = {
  doc: CardDocument
  side: SideName
  selectedId: string | null
  past: CardDocument[]
  future: CardDocument[]

  loadDoc: (doc: CardDocument) => void
  setSide: (side: SideName) => void
  select: (id: string | null) => void

  undo: () => void
  redo: () => void

  /**
   * Mark the start of a continuous gesture (drag/pinch). The next transient
   * update pushes ONE history entry, so the whole gesture undoes in one step.
   * A gesture that never moves adds nothing.
   */
  beginGesture: () => void

  /** One undoable command mutating the document. */
  apply: (mutate: (doc: CardDocument) => void) => void
  /** Live update during a gesture — no history entry (see beginGesture). */
  applyTransient: (mutate: (doc: CardDocument) => void) => void

  addLayer: (layer: Layer) => void
  deleteLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  /** Move a layer within the stack; dir +1 = toward the top (end of array). */
  moveLayer: (id: string, dir: 1 | -1) => void
  /** Move a layer to an absolute index in the side's array (drag-to-reorder). */
  moveLayerTo: (id: string, toIndex: number) => void
  renameLayer: (id: string, name: string) => void
  setLayerProps: (
    id: string,
    patch: Partial<Pick<Layer, 'opacity' | 'blendMode' | 'locked' | 'visible'>>,
  ) => void
  updateLayer: (
    id: string,
    mutate: (layer: Layer) => void,
    opts?: { transient?: boolean },
  ) => void

  pinColor: (color: Color) => void
  unpinColor: (color: Color) => void
  pushRecentColor: (color: Color) => void
  /** Append a starter palette's colors to pins (§6: appends, never replaces). */
  loadPalette: (colors: Color[]) => void
  /** Move a pinned swatch to a new index (drag reorder, §6). */
  reorderPins: (from: number, to: number) => void
}

export function findLayer(doc: CardDocument, side: SideName, id: string): Layer | undefined {
  return doc[side].layers.find((l) => l.id === id)
}

export function createEditorStore(initialDoc: CardDocument) {
  return create<EditorState>()((set, get) => {
    // Set by beginGesture, consumed by the first transient change after it.
    let pendingGestureSnapshot: CardDocument | null = null

    const commit = (next: CardDocument) => {
      const { doc, past } = get()
      if (next === doc) return
      pendingGestureSnapshot = null
      set({ doc: next, past: [...past, doc].slice(-HISTORY_DEPTH), future: [] })
    }

    const apply = (mutate: (doc: CardDocument) => void) => {
      const { doc } = get()
      const next = produce(doc, (draft) => {
        mutate(draft)
        draft.meta.updatedAt = new Date().toISOString()
      })
      commit(next)
    }

    const applyTransient = (mutate: (doc: CardDocument) => void) => {
      const { doc, past } = get()
      const next = produce(doc, mutate)
      if (next === doc) return
      if (pendingGestureSnapshot) {
        set({
          doc: next,
          past: [...past, pendingGestureSnapshot].slice(-HISTORY_DEPTH),
          future: [],
        })
        pendingGestureSnapshot = null
      } else {
        set({ doc: next })
      }
    }

    const mutateLayer = (id: string, mutate: (layer: Layer) => void) => (doc: CardDocument) => {
      const layer = doc[get().side].layers.find((l) => l.id === id)
      if (layer) mutate(layer)
    }

    return {
      doc: initialDoc,
      side: 'front',
      selectedId: null,
      past: [],
      future: [],

      loadDoc: (doc) => {
        pendingGestureSnapshot = null
        set({ doc, side: 'front', selectedId: null, past: [], future: [] })
      },
      setSide: (side) => set({ side, selectedId: null }),
      select: (id) => set({ selectedId: id }),

      undo: () => {
        const { doc, past, future } = get()
        if (past.length === 0) return
        pendingGestureSnapshot = null
        set({
          doc: past[past.length - 1],
          past: past.slice(0, -1),
          future: [doc, ...future],
        })
      },
      redo: () => {
        const { doc, past, future } = get()
        if (future.length === 0) return
        pendingGestureSnapshot = null
        set({
          doc: future[0],
          past: [...past, doc].slice(-HISTORY_DEPTH),
          future: future.slice(1),
        })
      },

      beginGesture: () => {
        pendingGestureSnapshot = get().doc
      },

      apply,
      applyTransient,

      addLayer: (layer) => {
        apply((doc) => {
          doc[get().side].layers.push(layer)
        })
        set({ selectedId: layer.id })
      },

      deleteLayer: (id) => {
        apply((doc) => {
          const layers = doc[get().side].layers
          const i = layers.findIndex((l) => l.id === id)
          if (i >= 0) layers.splice(i, 1)
        })
        if (get().selectedId === id) set({ selectedId: null })
      },

      duplicateLayer: (id) => {
        const source = findLayer(get().doc, get().side, id)
        if (!source) return
        const copy: Layer = JSON.parse(JSON.stringify(source))
        copy.id = newLayerId(source.type)
        copy.name = `${source.name} copy`
        // nudge so the copy is visibly a new object, not a rendering glitch
        // (full-card fills stay put — a nudged fill would leave a gap)
        if (source.type !== 'fill') {
          copy.transform = { ...copy.transform, x: copy.transform.x + 24, y: copy.transform.y + 24 }
        }
        apply((doc) => {
          const layers = doc[get().side].layers
          const i = layers.findIndex((l) => l.id === id)
          layers.splice(i + 1, 0, copy)
        })
        set({ selectedId: copy.id })
      },

      moveLayer: (id, dir) => {
        apply((doc) => {
          const layers = doc[get().side].layers
          const i = layers.findIndex((l) => l.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= layers.length) return
          const [layer] = layers.splice(i, 1)
          layers.splice(j, 0, layer)
        })
      },

      moveLayerTo: (id, toIndex) => {
        const layers = get().doc[get().side].layers
        const i = layers.findIndex((l) => l.id === id)
        const target = Math.max(0, Math.min(layers.length - 1, Math.round(toIndex)))
        if (i < 0 || target === i) return
        apply((doc) => {
          const arr = doc[get().side].layers
          const [layer] = arr.splice(i, 1)
          arr.splice(target, 0, layer)
        })
      },

      renameLayer: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        apply(mutateLayer(id, (l) => (l.name = trimmed)))
      },

      setLayerProps: (id, patch) => {
        apply(mutateLayer(id, (l) => Object.assign(l, patch)))
      },

      updateLayer: (id, mutate, opts) => {
        if (opts?.transient) applyTransient(mutateLayer(id, mutate))
        else apply(mutateLayer(id, mutate))
      },

      pinColor: (color) => {
        apply((doc) => {
          if (!doc.palette.pinned.includes(color)) doc.palette.pinned.push(color)
        })
      },
      unpinColor: (color) => {
        apply((doc) => {
          doc.palette.pinned = doc.palette.pinned.filter((c) => c !== color)
        })
      },
      loadPalette: (colors) => {
        // guard first: apply() always stamps updatedAt, so a no-op mutate
        // would still push a history entry
        if (colors.every((c) => get().doc.palette.pinned.includes(c))) return
        apply((doc) => {
          for (const c of colors) {
            if (!doc.palette.pinned.includes(c)) doc.palette.pinned.push(c)
          }
        })
      },

      reorderPins: (from, to) => {
        const pins = get().doc.palette.pinned
        if (from === to || from < 0 || from >= pins.length || to < 0 || to >= pins.length) return
        apply((doc) => {
          const [c] = doc.palette.pinned.splice(from, 1)
          doc.palette.pinned.splice(to, 0, c)
        })
      },

      // recents are a convenience trail, not an edit — no history entry
      pushRecentColor: (color) => {
        applyTransient((doc) => {
          doc.palette.recents = [
            color,
            ...doc.palette.recents.filter((c) => c !== color),
          ].slice(0, MAX_RECENTS)
        })
      },
    }
  })
}

/** Default fill layer for the "add layer" flow (M2). */
export function makeFillLayer(paint: Paint): Layer {
  return {
    id: newLayerId('fill'),
    name: 'Fill',
    type: 'fill',
    transform: defaultTransform(),
    opacity: 1,
    blendMode: 'srcOver',
    locked: false,
    visible: true,
    fill: { paint },
  }
}

/** Centered display-text layer (Add sheet). */
export function makeTextLayer(): Layer {
  return {
    id: newLayerId('text'),
    name: 'Text',
    type: 'text',
    transform: { x: CARD_W / 2, y: 520, rotation: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    blendMode: 'srcOver',
    locked: false,
    visible: true,
    text: { content: 'YOUR TEXT', font: 'anton', size: 72, color: '#ffffff', align: 'c' },
  }
}

/** Photo layer scaled to fit the card width, centered (M3). */
export function makeImageLayer(assetId: string, srcW: number, srcH: number): Layer {
  const w = Math.round(CARD_W * 0.9)
  const h = Math.round((srcH / Math.max(1, srcW)) * w)
  return {
    id: newLayerId('image'),
    name: 'Photo',
    type: 'image',
    transform: {
      x: (CARD_W - w) / 2,
      y: Math.max(40, (CARD_H - h) / 2),
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    opacity: 1,
    blendMode: 'srcOver',
    locked: false,
    visible: true,
    image: { assetId, cutout: 'none', w, h },
  }
}

/** Empty free-draw layer with the given stroke style (M3). */
export function makePathLayer(stroke: { color: Color; width: number }): Layer {
  return {
    id: newLayerId('path'),
    name: 'Drawing',
    type: 'path',
    transform: defaultTransform(),
    opacity: 1,
    blendMode: 'srcOver',
    locked: false,
    visible: true,
    path: { strokes: [], stroke: { ...stroke } },
  }
}

/** Empty stamp layer for the given shape (M3). */
export function makeStampLayer(shapeId: string, paint: Paint, baseSize: number): Layer {
  return {
    id: newLayerId('stamp'),
    name: 'Stamps',
    type: 'stamp',
    transform: defaultTransform(),
    opacity: 1,
    blendMode: 'srcOver',
    locked: false,
    visible: true,
    stamp: { shapeId, paint, instances: [], baseSize },
  }
}

/** Default shape layer, centered on the card (M2). */
export function makeShapeLayer(shapeId: string, paint: Paint, size = 320): Layer {
  // non-square shapes (Rectangle) declare their aspect on the library entry
  const aspect = getShape(shapeId)?.defaultAspect ?? 1
  const w = aspect >= 1 ? size * Math.sqrt(aspect) : size
  const h = w / aspect
  return {
    id: newLayerId('shape'),
    name: getShape(shapeId)?.name ?? shapeId.charAt(0).toUpperCase() + shapeId.slice(1),
    type: 'shape',
    transform: {
      x: (CARD_W - w) / 2,
      y: (CARD_H - h) / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    opacity: 1,
    blendMode: 'srcOver',
    locked: false,
    visible: true,
    shape: { shapeId, paint, w, h },
  }
}
