import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Canvas, Group, Skia, useCanvasRef } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import { defaultViewState } from '../model/types'
import type { Color } from '../model/types'
import { rgbaToHex } from '../model/color'
import { useEditor } from '../state/useEditor'
import { findLayer } from '../state/editorStore'
import { hitTest, layerBounds } from './bounds'
import { shapeContains } from './shapeHit'
import { applyPinch, beginPinch, pinchGeometry, type PinchStart } from './transformGesture'
import { layerColor, setLayerColor } from './layerColor'
import { ColorPicker } from './ColorPicker'
import { LayerPanel } from './LayerPanel'

// Editor core screen (M2, CLAUDE.md §4): card canvas with tap-to-select,
// one-finger drag-to-move, two-finger pinch/twist on the SELECTION —
// or, with nothing selected, two-finger zoom + pan of the CANVAS for
// fine placement work (one finger pans while zoomed; ⤢ chip resets).

const TAP_SLOP = 8
const MAX_ZOOM = 8

type CanvasView = { scale: number; x: number; y: number }

export function EditorScreen({ onPreview }: { onPreview: () => void }) {
  const { width } = useWindowDimensions()
  const doc = useEditor((s) => s.doc)
  const side = useEditor((s) => s.side)
  const setSide = useEditor((s) => s.setSide)
  const selectedId = useEditor((s) => s.selectedId)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)

  const docW = doc.size.w
  const docH = doc.size.h

  // ---- canvas view (zoom/pan) ----
  const [area, setArea] = useState({ w: 0, h: 0 })
  const maxCardWidth = Math.min(width - 32, 380)
  const base =
    area.h > 0
      ? Math.min(maxCardWidth / docW, (area.h - 16) / docH)
      : maxCardWidth / docW
  const [view, setView] = useState<CanvasView>({ scale: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view

  const total = base * view.scale
  const originX = (area.w - docW * total) / 2 + view.x
  const originY = (area.h - docH * total) / 2 + view.y

  const selected = selectedId
    ? doc[side].layers.find((l) => l.id === selectedId) ?? null
    : null
  const selectionBox = selected ? layerBounds(selected, doc) : null
  const selectedColor = selected ? layerColor(selected) : null

  const canvasRef = useCanvasRef()

  // ---- color picker + eyedropper ----
  const [pickerOpen, setPickerOpen] = useState(false)
  const [eyedropping, setEyedropping] = useState(false)
  const eyedroppingRef = useRef(false)
  eyedroppingRef.current = eyedropping
  const pickerOpenColor = useRef<Color | null>(null)

  useEffect(() => {
    // selection vanished (undo, delete) while the picker was up
    if (pickerOpen && (!selected || selectedColor === null)) {
      setPickerOpen(false)
      setEyedropping(false)
    }
  }, [pickerOpen, selected, selectedColor])

  const applyColor = useCallback((color: Color, transient: boolean) => {
    const s = useEditor.getState()
    if (!s.selectedId) return
    s.updateLayer(s.selectedId, (l) => setLayerColor(l, color), { transient })
  }, [])

  const openPicker = () => {
    pickerOpenColor.current = selectedColor
    setPickerOpen(true)
  }

  const closePicker = () => {
    const s = useEditor.getState()
    const current = s.selectedId ? layerColor(findLayer(s.doc, s.side, s.selectedId)!) : null
    if (current && current !== pickerOpenColor.current) s.pushRecentColor(current)
    setPickerOpen(false)
    setEyedropping(false)
  }

  /** Sample the rendered card at view coordinates (§6 eyedropper). */
  const sampleAt = (vx: number, vy: number) => {
    setEyedropping(false)
    const rect = Skia.XYWHRect(Math.max(0, Math.floor(vx)), Math.max(0, Math.floor(vy)), 1, 1)
    const image = canvasRef.current?.makeImageSnapshot(rect)
    const pixels = image?.readPixels()
    if (!pixels || pixels.length < 3) return
    const norm = pixels instanceof Float32Array ? (v: number) => v : (v: number) => v / 255
    applyColor(rgbaToHex(norm(pixels[0]), norm(pixels[1]), norm(pixels[2])), false)
  }

  // ---- canvas gestures ----
  // All gesture state lives in refs — responder callbacks must not close
  // over stale render values. One responder session = one undo step.
  const drag = useRef<{ id: string; startX: number; startY: number } | null>(null)
  const pinchStart = useRef<PinchStart | null>(null)
  const pinchLayerId = useRef<string | null>(null)
  const gestureStarted = useRef(false) // beginGesture called this session
  const sessionTransformed = useRef(false)
  const canvasPinch = useRef<{
    dist: number
    mid: { x: number; y: number }
    scale: number
    originX: number
    originY: number
  } | null>(null)
  const panFrom = useRef<CanvasView | null>(null)

  const panResponder = useMemo(() => {
    const origin = (v: CanvasView) => {
      const t = base * v.scale
      return {
        t,
        x: (area.w - docW * t) / 2 + v.x,
        y: (area.h - docH * t) / 2 + v.y,
      }
    }
    /** Clamp scale and offsets so the card never gets lost off-screen. */
    const clampView = (scale: number, offX: number, offY: number): CanvasView => {
      const s = Math.max(1, Math.min(MAX_ZOOM, scale))
      if (s === 1) return { scale: 1, x: 0, y: 0 }
      const cw = docW * base * s
      const ch = docH * base * s
      const cX = (area.w - cw) / 2
      const cY = (area.h - ch) / 2
      const ox = cw >= area.w ? Math.max(area.w - cw, Math.min(0, cX + offX)) : cX
      const oy = ch >= area.h ? Math.max(area.h - ch, Math.min(0, cY + offY)) : cY
      return { scale: s, x: ox - cX, y: oy - cY }
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        pinchStart.current = null
        pinchLayerId.current = null
        canvasPinch.current = null
        gestureStarted.current = false
        sessionTransformed.current = false
        drag.current = null
        panFrom.current = { ...viewRef.current }
        if (eyedroppingRef.current) return
        const s = useEditor.getState()
        const o = origin(viewRef.current)
        const x = (e.nativeEvent.locationX - o.x) / o.t
        const y = (e.nativeEvent.locationY - o.y) / o.t
        const sel = s.selectedId ? findLayer(s.doc, s.side, s.selectedId) : undefined
        if (sel && !sel.locked) {
          const b = layerBounds(sel, s.doc)
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            drag.current = { id: sel.id, startX: sel.transform.x, startY: sel.transform.y }
            s.beginGesture()
            gestureStarted.current = true
          }
        }
      },
      onPanResponderMove: (e, g) => {
        const s = useEditor.getState()
        const touches = e.nativeEvent.touches

        if (touches.length >= 2) {
          const o = origin(viewRef.current)
          const sel = s.selectedId ? findLayer(s.doc, s.side, s.selectedId) : undefined

          // selection: two fingers transform the layer
          if (sel && !sel.locked) {
            const a = {
              x: (touches[0].locationX - o.x) / o.t,
              y: (touches[0].locationY - o.y) / o.t,
            }
            const b = {
              x: (touches[1].locationX - o.x) / o.t,
              y: (touches[1].locationY - o.y) / o.t,
            }
            if (!pinchStart.current || pinchLayerId.current !== sel.id) {
              if (!gestureStarted.current) {
                s.beginGesture()
                gestureStarted.current = true
              }
              pinchStart.current = beginPinch(sel, s.doc, a, b)
              pinchLayerId.current = sel.id
              drag.current = null
              return
            }
            const next = applyPinch(pinchStart.current, a, b)
            sessionTransformed.current = true
            s.updateLayer(sel.id, (l) => void (l.transform = next), { transient: true })
            return
          }

          // no selection: two fingers zoom/pan the canvas
          const geom = pinchGeometry(
            { x: touches[0].locationX, y: touches[0].locationY },
            { x: touches[1].locationX, y: touches[1].locationY },
          )
          if (!canvasPinch.current) {
            if (geom.dist < 1) return
            canvasPinch.current = {
              dist: geom.dist,
              mid: geom.mid,
              scale: viewRef.current.scale,
              originX: o.x,
              originY: o.y,
            }
            drag.current = null
            return
          }
          const cp = canvasPinch.current
          const newScale = Math.max(1, Math.min(MAX_ZOOM, cp.scale * (geom.dist / cp.dist)))
          const t0 = base * cp.scale
          const newT = base * newScale
          // keep the doc point that was under the start midpoint under the
          // current midpoint
          const docMidX = (cp.mid.x - cp.originX) / t0
          const docMidY = (cp.mid.y - cp.originY) / t0
          const desiredOriginX = geom.mid.x - docMidX * newT
          const desiredOriginY = geom.mid.y - docMidY * newT
          const cX = (area.w - docW * newT) / 2
          const cY = (area.h - docH * newT) / 2
          setView(clampView(newScale, desiredOriginX - cX, desiredOriginY - cY))
          return
        }

        // a finger lifted mid-pinch: freeze until the session ends
        if (pinchStart.current || canvasPinch.current) return

        if (drag.current) {
          if (Math.abs(g.dx) <= TAP_SLOP && Math.abs(g.dy) <= TAP_SLOP) return
          const o = origin(viewRef.current)
          const { id, startX, startY } = drag.current
          sessionTransformed.current = true
          s.updateLayer(
            id,
            (l) => {
              l.transform.x = startX + g.dx / o.t
              l.transform.y = startY + g.dy / o.t
            },
            { transient: true },
          )
          return
        }

        // one finger off the selection: pan the canvas while zoomed
        if (viewRef.current.scale > 1 && panFrom.current) {
          if (Math.abs(g.dx) <= TAP_SLOP && Math.abs(g.dy) <= TAP_SLOP) return
          setView(clampView(panFrom.current.scale, panFrom.current.x + g.dx, panFrom.current.y + g.dy))
        }
      },
      onPanResponderRelease: (e, g) => {
        const pinched = pinchStart.current !== null || canvasPinch.current !== null
        drag.current = null
        pinchStart.current = null
        pinchLayerId.current = null
        canvasPinch.current = null
        panFrom.current = null
        if (pinched || sessionTransformed.current) return
        if (Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP) return
        // a tap
        const vx = e.nativeEvent.locationX
        const vy = e.nativeEvent.locationY
        if (eyedroppingRef.current) {
          sampleAt(vx, vy)
          return
        }
        const s = useEditor.getState()
        const o = origin(viewRef.current)
        const hit = hitTest(s.doc, s.side, (vx - o.x) / o.t, (vy - o.y) / o.t, { shapeContains })
        s.select(hit ? hit.id : null)
      },
      onPanResponderTerminate: () => {
        drag.current = null
        pinchStart.current = null
        pinchLayerId.current = null
        canvasPinch.current = null
        panFrom.current = null
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, area.w, area.h, docW, docH])

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

      <View
        style={styles.canvasArea}
        onLayout={(e) =>
          setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
        {...panResponder.panHandlers}
      >
        {area.w > 0 && area.h > 0 ? (
          <>
            <Canvas ref={canvasRef} style={{ width: area.w, height: area.h }}>
              <Group transform={[{ translateX: originX }, { translateY: originY }]}>
                <CardRenderer doc={doc} side={side} viewState={defaultViewState()} scale={total} />
              </Group>
            </Canvas>
            {selectionBox && !eyedropping ? (
              <View
                pointerEvents="none"
                style={[
                  styles.selection,
                  {
                    left: selectionBox.x * total + originX - 2,
                    top: selectionBox.y * total + originY - 2,
                    width: selectionBox.w * total + 4,
                    height: selectionBox.h * total + 4,
                  },
                ]}
              />
            ) : null}
            {view.scale > 1 ? (
              <Pressable
                style={styles.zoomChip}
                hitSlop={6}
                onPress={() => setView({ scale: 1, x: 0, y: 0 })}
              >
                <Text style={styles.zoomChipText}>{Math.round(view.scale * 100)}% ⤢</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>

      {selected ? (
        <View style={styles.propsBar}>
          <Text style={styles.propsName} numberOfLines={1}>
            {selected.name}
          </Text>
          <Text style={styles.propsInfo}>
            {Math.round(selected.transform.rotation)}° · ×
            {(((Math.abs(selected.transform.scaleX) + Math.abs(selected.transform.scaleY)) / 2)).toFixed(2)}
          </Text>
          {selectedColor ? (
            <Pressable style={styles.colorChipBack} hitSlop={6} onPress={openPicker}>
              <View style={[styles.colorChip, { backgroundColor: selectedColor }]} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <LayerPanel />

      {eyedropping ? (
        <View style={styles.eyedropBanner} pointerEvents="box-none">
          <Text style={styles.eyedropText}>Tap the card to sample a color</Text>
          <Pressable hitSlop={8} onPress={() => setEyedropping(false)}>
            <Text style={styles.eyedropCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {pickerOpen && !eyedropping && selectedColor ? (
        <ColorPicker
          value={selectedColor}
          onChange={applyColor}
          onGestureStart={() => useEditor.getState().beginGesture()}
          onClose={closePicker}
          onEyedropper={() => setEyedropping(true)}
        />
      ) : null}
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
  canvasArea: { flex: 1, overflow: 'hidden' },
  selection: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4da3ff',
    borderRadius: 3,
  },
  zoomChip: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#1c2233ee',
  },
  zoomChipText: { color: '#c9d6ea', fontSize: 12, fontVariant: ['tabular-nums'] },
  propsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0d1120',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#232b42',
  },
  propsName: { color: '#e6ecf7', fontSize: 13, flex: 1 },
  propsInfo: { color: '#5a6478', fontSize: 12, fontVariant: ['tabular-nums'] },
  colorChipBack: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3d4a6e',
  },
  colorChip: { flex: 1 },
  eyedropBanner: {
    position: 'absolute',
    top: 108,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1c2233ee',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  eyedropText: { color: '#e6ecf7', fontSize: 13 },
  eyedropCancel: { color: '#4da3ff', fontSize: 13, fontWeight: '600' },
})
