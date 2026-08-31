import React, { useMemo, useRef } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Canvas } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import { defaultViewState } from '../model/types'
import { useEditor } from '../state/useEditor'
import { hitTest, layerBounds } from './bounds'
import { LayerPanel } from './LayerPanel'

// Editor core screen (M2, CLAUDE.md §4): flat card canvas with tap-to-select
// and drag-to-move, undo/redo, front/back switch, layer panel below.
// TODO(M2): two-finger pinch-to-scale and twist-to-rotate on the selection.

const TAP_SLOP = 8

export function EditorScreen({ onPreview }: { onPreview: () => void }) {
  const { width } = useWindowDimensions()
  const doc = useEditor((s) => s.doc)
  const side = useEditor((s) => s.side)
  const setSide = useEditor((s) => s.setSide)
  const selectedId = useEditor((s) => s.selectedId)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)

  const cardWidth = Math.min(width - 32, 380)
  const scale = cardWidth / doc.size.w
  const cardHeight = doc.size.h * scale

  const selected = selectedId
    ? doc[side].layers.find((l) => l.id === selectedId) ?? null
    : null
  const selectionBox = selected ? layerBounds(selected, doc) : null

  // Drag state lives in refs — the pan responder callbacks must not close
  // over stale render values.
  const drag = useRef<{ id: string; startX: number; startY: number } | null>(null)

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const s = useEditor.getState()
          const x = e.nativeEvent.locationX / scale
          const y = e.nativeEvent.locationY / scale
          const sel = s.selectedId ? s.doc[s.side].layers.find((l) => l.id === s.selectedId) : null
          if (sel && !sel.locked) {
            const b = layerBounds(sel, s.doc)
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
              drag.current = { id: sel.id, startX: sel.transform.x, startY: sel.transform.y }
              s.beginGesture()
              return
            }
          }
          drag.current = null
        },
        onPanResponderMove: (_e, g) => {
          if (!drag.current) return
          if (Math.abs(g.dx) <= TAP_SLOP && Math.abs(g.dy) <= TAP_SLOP) return
          const { id, startX, startY } = drag.current
          useEditor.getState().updateLayer(
            id,
            (l) => {
              l.transform.x = startX + g.dx / scale
              l.transform.y = startY + g.dy / scale
            },
            { transient: true },
          )
        },
        onPanResponderRelease: (e, g) => {
          const moved = Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP
          drag.current = null
          if (moved) return
          // a tap: select whatever is under the finger (or clear)
          const s = useEditor.getState()
          const x = e.nativeEvent.locationX / scale
          const y = e.nativeEvent.locationY / scale
          const hit = hitTest(s.doc, s.side, x, y)
          s.select(hit ? hit.id : null)
        },
        onPanResponderTerminate: () => {
          drag.current = null
        },
      }),
    [scale],
  )

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Pressable style={styles.toolButton} onPress={onPreview} hitSlop={6}>
          <Text style={styles.toolText}>Preview</Text>
        </Pressable>

        <View style={styles.sideSwitch}>
          {(['front', 'back'] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.sideOption, side === s && styles.sideOptionActive]}
              onPress={() => setSide(s)}
            >
              <Text style={[styles.sideText, side === s && styles.sideTextActive]}>
                {s === 'front' ? 'Front' : 'Back'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.historyButtons}>
          <Pressable
            style={styles.toolButton}
            hitSlop={6}
            disabled={!canUndo}
            onPress={() => useEditor.getState().undo()}
          >
            <Text style={[styles.toolText, !canUndo && styles.toolTextDisabled]}>↩</Text>
          </Pressable>
          <Pressable
            style={styles.toolButton}
            hitSlop={6}
            disabled={!canRedo}
            onPress={() => useEditor.getState().redo()}
          >
            <Text style={[styles.toolText, !canRedo && styles.toolTextDisabled]}>↪</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.canvasArea}>
        <View style={{ width: cardWidth, height: cardHeight }} {...panResponder.panHandlers}>
          <Canvas style={{ width: cardWidth, height: cardHeight }}>
            <CardRenderer doc={doc} side={side} viewState={defaultViewState()} scale={scale} />
          </Canvas>
          {selectionBox ? (
            <View
              pointerEvents="none"
              style={[
                styles.selection,
                {
                  left: selectionBox.x * scale - 2,
                  top: selectionBox.y * scale - 2,
                  width: selectionBox.w * scale + 4,
                  height: selectionBox.h * scale + 4,
                },
              ]}
            />
          ) : null}
        </View>
      </View>

      <LayerPanel />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090f' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toolButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1c2233',
  },
  toolText: { color: '#c9d6ea', fontSize: 14 },
  toolTextDisabled: { color: '#3d4560' },
  historyButtons: { flexDirection: 'row', gap: 8 },
  sideSwitch: {
    flexDirection: 'row',
    backgroundColor: '#12162a',
    borderRadius: 16,
    padding: 2,
  },
  sideOption: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  sideOptionActive: { backgroundColor: '#2a3554' },
  sideText: { color: '#7f8db0', fontSize: 13 },
  sideTextActive: { color: '#e6ecf7' },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  selection: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4da3ff',
    borderRadius: 3,
  },
})
