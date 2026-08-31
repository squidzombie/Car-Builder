import { describe, test, expect } from '@jest/globals'
import { createEditorStore, HISTORY_DEPTH, makeFillLayer, makeShapeLayer } from '../editorStore'
import { blankCard } from '../../templates/blank'
import { serializeCard, deserializeCard } from '../../model/serialize'

const freshStore = () => createEditorStore(blankCard('test-card'))

describe('editor store', () => {
  test('addLayer appends to the active side and selects it', () => {
    const store = freshStore()
    const layer = makeShapeLayer('star5', { color: '#ff0000' })
    store.getState().addLayer(layer)
    const s = store.getState()
    expect(s.doc.front.layers.map((l) => l.id)).toContain(layer.id)
    expect(s.selectedId).toBe(layer.id)
    expect(s.doc.back.layers).toHaveLength(0)
  })

  test('undo/redo walk a command back and forth', () => {
    const store = freshStore()
    const layer = makeFillLayer({ color: '#123456' })
    store.getState().addLayer(layer)
    expect(store.getState().doc.front.layers).toHaveLength(1)

    store.getState().undo()
    expect(store.getState().doc.front.layers).toHaveLength(0)

    store.getState().redo()
    expect(store.getState().doc.front.layers).toHaveLength(1)
  })

  test('a new command clears the redo stack', () => {
    const store = freshStore()
    store.getState().addLayer(makeFillLayer({ color: '#111111' }))
    store.getState().undo()
    store.getState().addLayer(makeFillLayer({ color: '#222222' }))
    store.getState().redo() // nothing to redo
    const s = store.getState()
    expect(s.future).toHaveLength(0)
    expect(s.doc.front.layers).toHaveLength(1)
    expect((s.doc.front.layers[0].fill!.paint as { color: string }).color).toBe('#222222')
  })

  test(`history is capped at ${HISTORY_DEPTH}`, () => {
    const store = freshStore()
    for (let i = 0; i < HISTORY_DEPTH + 10; i++) {
      store.getState().addLayer(makeFillLayer({ color: '#000000' }))
    }
    expect(store.getState().past.length).toBe(HISTORY_DEPTH)
    for (let i = 0; i < HISTORY_DEPTH + 10; i++) store.getState().undo()
    // only HISTORY_DEPTH steps could be undone
    expect(store.getState().doc.front.layers.length).toBe(10)
  })

  test('duplicate creates an independent deep copy above the source', () => {
    const store = freshStore()
    const layer = makeShapeLayer('shield', { color: '#00ff00' })
    store.getState().addLayer(layer)
    store.getState().duplicateLayer(layer.id)

    const s = store.getState()
    expect(s.doc.front.layers).toHaveLength(2)
    const copy = s.doc.front.layers[1]
    expect(copy.id).not.toBe(layer.id)
    expect(copy.name).toBe(`${layer.name} copy`)
    expect(s.selectedId).toBe(copy.id)

    // mutating the original must not touch the copy
    store.getState().updateLayer(layer.id, (l) => {
      l.shape!.paint = { color: '#0000ff' }
    })
    const after = store.getState().doc.front.layers
    expect((after[0].shape!.paint as { color: string }).color).toBe('#0000ff')
    expect((after[1].shape!.paint as { color: string }).color).toBe('#00ff00')
  })

  test('moveLayer reorders within bounds and clamps at the edges', () => {
    const store = freshStore()
    const a = makeFillLayer({ color: '#aaaaaa' })
    const b = makeFillLayer({ color: '#bbbbbb' })
    store.getState().addLayer(a)
    store.getState().addLayer(b)

    store.getState().moveLayer(a.id, 1)
    expect(store.getState().doc.front.layers.map((l) => l.id)).toEqual([b.id, a.id])

    store.getState().moveLayer(a.id, 1) // already on top — no change, but recorded safely
    expect(store.getState().doc.front.layers.map((l) => l.id)).toEqual([b.id, a.id])
  })

  test('deleteLayer clears selection of the deleted layer', () => {
    const store = freshStore()
    const layer = makeFillLayer({ color: '#cccccc' })
    store.getState().addLayer(layer)
    store.getState().deleteLayer(layer.id)
    const s = store.getState()
    expect(s.doc.front.layers).toHaveLength(0)
    expect(s.selectedId).toBeNull()
  })

  test('a gesture of many transient updates is one undo step', () => {
    const store = freshStore()
    const layer = makeShapeLayer('circle', { color: '#ffffff' })
    store.getState().addLayer(layer)

    store.getState().beginGesture()
    for (let x = 1; x <= 30; x++) {
      store.getState().updateLayer(layer.id, (l) => (l.transform.x = x), { transient: true })
    }
    expect(store.getState().doc.front.layers[0].transform.x).toBe(30)

    store.getState().undo() // whole drag
    expect(store.getState().doc.front.layers[0].transform.x).toBe(
      makeShapeLayer('circle', { color: '#ffffff' }).transform.x,
    )
    store.getState().undo() // the add itself
    expect(store.getState().doc.front.layers).toHaveLength(0)
  })

  test('a gesture that never moves adds no history entry', () => {
    const store = freshStore()
    store.getState().addLayer(makeFillLayer({ color: '#dddddd' }))
    const depth = store.getState().past.length
    store.getState().beginGesture()
    expect(store.getState().past.length).toBe(depth)
  })

  test('side switch scopes layer commands to that side', () => {
    const store = freshStore()
    store.getState().setSide('back')
    const layer = makeFillLayer({ color: '#eeeeee' })
    store.getState().addLayer(layer)
    const s = store.getState()
    expect(s.doc.back.layers).toHaveLength(1)
    expect(s.doc.front.layers).toHaveLength(0)
  })

  test('recent colors dedupe, cap at 12, and are not undo steps', () => {
    const store = freshStore()
    for (let i = 0; i < 15; i++) store.getState().pushRecentColor(`#0000${String(i).padStart(2, '0')}`)
    store.getState().pushRecentColor('#000003')
    const s = store.getState()
    expect(s.doc.palette.recents).toHaveLength(12)
    expect(s.doc.palette.recents[0]).toBe('#000003')
    expect(s.past).toHaveLength(0)
  })

  test('document survives serialize round-trip after edits', () => {
    const store = freshStore()
    store.getState().addLayer(makeShapeLayer('hexagon', { color: '#a1b2c3' }))
    store.getState().setLayerProps(store.getState().selectedId!, { opacity: 0.5, locked: true })
    const doc = store.getState().doc
    expect(deserializeCard(serializeCard(doc))).toEqual(doc)
  })

  test('multi-stroke paths and custom shapes survive the round-trip', () => {
    const store = freshStore()
    store.getState().apply((doc) => {
      doc.shapes = [{ id: 'c1', name: '8-star', path: 'M0 0 L1 0 L1 1 Z', builtIn: false }]
      doc.front.layers.push({
        id: 'p1',
        name: 'Drawing',
        type: 'path',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        opacity: 1,
        blendMode: 'srcOver',
        locked: false,
        visible: true,
        path: {
          strokes: [
            { points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
            { points: [{ x: 5, y: 6 }] },
          ],
          stroke: { color: '#ffffff', width: 14 },
        },
      })
    })
    const doc = store.getState().doc
    expect(deserializeCard(serializeCard(doc))).toEqual(doc)
  })

  test('loadPalette appends without duplicates, as one undo step', () => {
    const store = freshStore()
    store.getState().pinColor('#111111')
    const depth = store.getState().past.length
    store.getState().loadPalette(['#111111', '#222222', '#333333'])
    let s = store.getState()
    expect(s.doc.palette.pinned).toEqual(['#111111', '#222222', '#333333'])
    expect(s.past.length).toBe(depth + 1)
    store.getState().undo()
    expect(store.getState().doc.palette.pinned).toEqual(['#111111'])
  })

  test('reorderPins moves a swatch and rejects bad indices', () => {
    const store = freshStore()
    store.getState().loadPalette(['#aa0000', '#00bb00', '#0000cc'])
    store.getState().reorderPins(0, 2)
    expect(store.getState().doc.palette.pinned).toEqual(['#00bb00', '#0000cc', '#aa0000'])
    const depth = store.getState().past.length
    store.getState().reorderPins(1, 1)
    store.getState().reorderPins(-1, 0)
    store.getState().reorderPins(0, 9)
    expect(store.getState().doc.palette.pinned).toEqual(['#00bb00', '#0000cc', '#aa0000'])
    expect(store.getState().past.length).toBe(depth)
  })
})
