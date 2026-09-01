import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Canvas, Group, Skia, useCanvasRef } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import { defaultViewState, lightFromTilt } from '../model/types'
import type { ViewState } from '../model/types'
import type { Color, Layer, Point } from '../model/types'
import { rgbaToHex } from '../model/color'
import { BUILTIN_SHAPES } from '../model/shapes'
import { useEditor } from '../state/useEditor'
import { findLayer, makePathLayer, makeShapeLayer, makeStampLayer } from '../state/editorStore'
import { hitTest, layerBounds, toLocal } from './bounds'
import { makeShapeContains } from './shapeHit'
import {
  applyPinch,
  applyResize,
  beginPinch,
  beginResize,
  pinchGeometry,
  type PinchStart,
  type ResizeStart,
} from './transformGesture'
import {
  jitterInstance,
  mirrorRotation,
  polylineNear,
  stampRotation,
  symmetryVariants,
  type SymmetryVariant,
} from './tools'
import { layerColor, setLayerColor } from './layerColor'
import { Feather } from '@expo/vector-icons'
import { ColorPicker } from './ColorPicker'
import { LayerPanel } from './LayerPanel'
import { AddSheet } from './AddSheet'
import { ShapeBuilder } from './ShapeBuilder'
import { MaskEditor } from './MaskEditor'
import { TextEditor } from './TextEditor'
import { FinishEditor } from './FinishEditor'
import { useDocImages } from '../view/useDocImages'
import { ToolBar, type DrawSettings, type EditorMode, type StampSettings } from './ToolBar'

// Editor screen (M2 core + M3 tools, CLAUDE.md §4).
// Select mode: tap-to-select, one-finger drag, two-finger pinch/twist on
// the selection — or, with nothing selected, two-finger canvas zoom/pan.
// Draw/stamp modes: one finger is the tool, two fingers always zoom/pan
// (an in-flight stroke cancels cleanly via undo).

const TAP_SLOP = 8
const MAX_ZOOM = 8

type CanvasView = { scale: number; x: number; y: number }
type PickerTarget = 'layer' | 'draw' | 'stamp'

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

  // ---- tools (M3) ----
  const [mode, setModeState] = useState<EditorMode>('select')
  const [draw, setDraw] = useState<DrawSettings>({
    width: 14,
    color: '#ffffff',
    eraser: false,
    symmetry: 'off',
  })
  const [stamp, setStamp] = useState<StampSettings>({
    shapeId: 'star5',
    size: 84,
    rotMode: 'fixed',
    jitter: false,
    color: '#f1c40f',
    symmetry: 'off',
  })
  const toolRef = useRef({ mode, draw, stamp })
  toolRef.current = { mode, draw, stamp }
  const [builderOpen, setBuilderOpen] = useState(false)
  const builderOrigin = useRef<'stamp' | 'add'>('stamp')
  const [addOpen, setAddOpen] = useState(false)
  const [maskOpen, setMaskOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [fxOpen, setFxOpen] = useState(false)

  // (the finish-sheet tilt sweep lives inside EditorCanvas so its 60fps
  // state updates re-render only the canvas, not the whole screen)

  const allShapes = useMemo(() => [...BUILTIN_SHAPES, ...(doc.shapes ?? [])], [doc.shapes])
  const assets = useDocImages(doc)

  useEffect(() => {
    // the edited layer vanished (undo/delete) while a sheet was up
    if ((maskOpen || textOpen || fxOpen) && !selected) {
      setMaskOpen(false)
      setTextOpen(false)
      setFxOpen(false)
    }
  }, [maskOpen, textOpen, fxOpen, selected])

  // ---- color picker + eyedropper ----
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>('layer')
  const pickerTargetRef = useRef(pickerTarget)
  pickerTargetRef.current = pickerTarget
  const [eyedropping, setEyedropping] = useState(false)
  const eyedroppingRef = useRef(false)
  eyedroppingRef.current = eyedropping
  const pickerOpenColor = useRef<Color | null>(null)

  const pickerColor =
    pickerTarget === 'layer' ? selectedColor : pickerTarget === 'draw' ? draw.color : stamp.color
  const pickerColorRef = useRef(pickerColor)
  pickerColorRef.current = pickerColor

  const setMode = (m: EditorMode) => {
    setModeState(m)
    setPickerOpen(false)
    setEyedropping(false)
  }

  useEffect(() => {
    // layer target's selection vanished (undo, delete) while the picker was up
    if (pickerOpen && pickerTarget === 'layer' && (!selected || selectedColor === null)) {
      setPickerOpen(false)
      setEyedropping(false)
    }
  }, [pickerOpen, pickerTarget, selected, selectedColor])

  const applyColor = useCallback((color: Color, transient: boolean) => {
    const target = pickerTargetRef.current
    if (target === 'draw') {
      setDraw((d) => ({ ...d, color, eraser: false }))
      return
    }
    if (target === 'stamp') {
      setStamp((st) => ({ ...st, color }))
      return
    }
    const s = useEditor.getState()
    if (!s.selectedId) return
    s.updateLayer(s.selectedId, (l) => setLayerColor(l, color), { transient })
  }, [])

  const openPicker = (target: PickerTarget) => {
    setPickerTarget(target)
    pickerOpenColor.current =
      target === 'layer' ? selectedColor : target === 'draw' ? toolRef.current.draw.color : toolRef.current.stamp.color
    setPickerOpen(true)
  }

  const closePicker = () => {
    const current = pickerColorRef.current
    if (current && current !== pickerOpenColor.current) {
      useEditor.getState().pushRecentColor(current)
    }
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
  const resizeSession = useRef<{ id: string; start: ResizeStart } | null>(null)
  const pinchStart = useRef<PinchStart | null>(null)
  const pinchLayerId = useRef<string | null>(null)
  const gestureStarted = useRef(false)
  const sessionTransformed = useRef(false)
  const canvasPinch = useRef<{
    dist: number
    mid: { x: number; y: number }
    scale: number
    originX: number
    originY: number
  } | null>(null)
  const panFrom = useRef<CanvasView | null>(null)
  const drawSession = useRef<{
    layerId: string
    base: number
    variants: SymmetryVariant[]
    last: Point
    count: number
  } | null>(null)
  const stampSession = useRef<{
    layerId: string
    variants: SymmetryVariant[]
    last: Point
    baseSize: number
  } | null>(null)
  const eraseSession = useRef<{ layerId: string; changed: boolean } | null>(null)

  const panResponder = useMemo(() => {
    const origin = (v: CanvasView) => {
      const t = base * v.scale
      return {
        t,
        x: (area.w - docW * t) / 2 + v.x,
        y: (area.h - docH * t) / 2 + v.y,
      }
    }
    const docPoint = (locX: number, locY: number): Point => {
      const o = origin(viewRef.current)
      return { x: (locX - o.x) / o.t, y: (locY - o.y) / o.t }
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

    // ---- draw tool ----
    const startDraw = (p: Point) => {
      const s = useEditor.getState()
      const t = toolRef.current.draw
      if (t.eraser) {
        const sel = s.selectedId ? findLayer(s.doc, s.side, s.selectedId) : undefined
        if (!sel || sel.type !== 'path' || sel.locked) return
        s.beginGesture()
        gestureStarted.current = true
        eraseSession.current = { layerId: sel.id, changed: false }
        eraseAt(p)
        return
      }
      const variants = symmetryVariants(t.symmetry, docW, docH)
      const sel = s.selectedId ? findLayer(s.doc, s.side, s.selectedId) : undefined
      s.beginGesture()
      gestureStarted.current = true
      let layerId: string
      let strokeBase: number
      if (
        sel?.type === 'path' &&
        !sel.locked &&
        sel.path!.stroke.color === t.color &&
        sel.path!.stroke.width === t.width
      ) {
        layerId = sel.id
        strokeBase = sel.path!.strokes.length
        s.applyTransient((d) => {
          const l = findLayer(d, s.side, layerId)
          if (l?.path) variants.forEach((v) => l.path!.strokes.push({ points: [v.map(p)] }))
        })
      } else {
        const layer: Layer = makePathLayer({ color: t.color, width: t.width })
        layer.path!.strokes = variants.map((v) => ({ points: [v.map(p)] }))
        layerId = layer.id
        strokeBase = 0
        s.applyTransient((d) => {
          d[s.side].layers.push(layer)
        })
        s.select(layerId)
      }
      drawSession.current = { layerId, base: strokeBase, variants, last: p, count: 1 }
    }

    const moveDraw = (p: Point) => {
      const ds = drawSession.current
      if (!ds) return
      if (Math.hypot(p.x - ds.last.x, p.y - ds.last.y) < 3) return
      ds.last = p
      ds.count++
      const s = useEditor.getState()
      s.applyTransient((d) => {
        const l = findLayer(d, s.side, ds.layerId)
        if (!l?.path) return
        ds.variants.forEach((v, k) => l.path!.strokes[ds.base + k]?.points.push(v.map(p)))
      })
    }

    const endDraw = () => {
      const ds = drawSession.current
      if (!ds) return
      drawSession.current = null
      if (ds.count > 1) return
      // a tap: extend the single point so the round cap renders as a dot
      const s = useEditor.getState()
      s.applyTransient((d) => {
        const l = findLayer(d, s.side, ds.layerId)
        ds.variants.forEach((_v, k) => {
          const st = l?.path?.strokes[ds.base + k]
          if (st && st.points.length === 1) {
            st.points.push({ x: st.points[0].x + 0.1, y: st.points[0].y })
          }
        })
      })
    }

    const eraseAt = (p: Point) => {
      const es = eraseSession.current
      if (!es) return
      const s = useEditor.getState()
      s.applyTransient((d) => {
        const l = findLayer(d, s.side, es.layerId)
        if (!l?.path) return
        const lp = toLocal(l, p.x, p.y)
        if (!lp) return
        const reach = l.path.stroke.width / 2 + 16
        const before = l.path.strokes.length
        l.path.strokes = l.path.strokes.filter((st) => !polylineNear(st.points, lp, reach))
        if (l.path.strokes.length !== before) es.changed = true
      })
    }

    // ---- stamp tool ----
    const placeStamp = (p: Point, angleDeg: number) => {
      const ss = stampSession.current
      if (!ss) return
      const t = toolRef.current.stamp
      const rot = stampRotation(t.rotMode, angleDeg)
      const j = t.jitter ? jitterInstance(p, t.size) : { x: p.x, y: p.y, scaleMul: 1 }
      const s = useEditor.getState()
      s.applyTransient((d) => {
        const l = findLayer(d, s.side, ss.layerId)
        if (!l?.stamp) return
        for (const v of ss.variants) {
          const mp = v.map({ x: j.x, y: j.y })
          l.stamp.instances.push({
            x: mp.x,
            y: mp.y,
            rotation: mirrorRotation(rot, v.flips),
            scale: (t.size / ss.baseSize) * j.scaleMul,
          })
        }
      })
    }

    const startStamp = (p: Point) => {
      const s = useEditor.getState()
      const t = toolRef.current.stamp
      const variants = symmetryVariants(t.symmetry, docW, docH)
      const sel = s.selectedId ? findLayer(s.doc, s.side, s.selectedId) : undefined
      s.beginGesture()
      gestureStarted.current = true
      let layerId: string
      let baseSize: number
      if (
        sel?.type === 'stamp' &&
        !sel.locked &&
        sel.stamp!.shapeId === t.shapeId &&
        'color' in sel.stamp!.paint &&
        sel.stamp!.paint.color === t.color
      ) {
        layerId = sel.id
        baseSize = sel.stamp!.baseSize
      } else {
        const layer = makeStampLayer(t.shapeId, { color: t.color }, t.size)
        layerId = layer.id
        baseSize = t.size
        s.applyTransient((d) => {
          d[s.side].layers.push(layer)
        })
        s.select(layerId)
      }
      stampSession.current = { layerId, variants, last: p, baseSize }
      placeStamp(p, 0)
    }

    const moveStamp = (p: Point) => {
      const ss = stampSession.current
      if (!ss) return
      const t = toolRef.current.stamp
      const spacing = Math.max(24, t.size * 1.15)
      const dx = p.x - ss.last.x
      const dy = p.y - ss.last.y
      if (Math.hypot(dx, dy) < spacing) return
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      ss.last = p
      placeStamp(p, angle)
    }

    /** A second finger landed mid-tool-stroke: revert it and hand over to zoom. */
    const cancelToolSession = () => {
      const active =
        drawSession.current !== null ||
        stampSession.current !== null ||
        (eraseSession.current !== null && eraseSession.current.changed)
      if (drawSession.current || stampSession.current || eraseSession.current) {
        if (active && gestureStarted.current) useEditor.getState().undo()
        drawSession.current = null
        stampSession.current = null
        eraseSession.current = null
        gestureStarted.current = false
      }
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
        drawSession.current = null
        stampSession.current = null
        eraseSession.current = null
        panFrom.current = { ...viewRef.current }
        if (eyedroppingRef.current) return
        const p = docPoint(e.nativeEvent.locationX, e.nativeEvent.locationY)
        const tool = toolRef.current
        if (tool.mode === 'draw') {
          startDraw(p)
          return
        }
        if (tool.mode === 'stamp') {
          startStamp(p)
          return
        }
        const s = useEditor.getState()
        const sel = s.selectedId ? findLayer(s.doc, s.side, s.selectedId) : undefined
        if (sel && !sel.locked) {
          const b = layerBounds(sel, s.doc)
          // corner handle → non-uniform resize (Build 5: rectangles!)
          const o = origin(viewRef.current)
          const vx = e.nativeEvent.locationX
          const vy = e.nativeEvent.locationY
          const corners: [number, number][] = [
            [b.x, b.y],
            [b.x + b.w, b.y],
            [b.x, b.y + b.h],
            [b.x + b.w, b.y + b.h],
          ]
          for (let i = 0; i < 4; i++) {
            const hx = corners[i][0] * o.t + o.x
            const hy = corners[i][1] * o.t + o.y
            if (Math.hypot(vx - hx, vy - hy) < 24) {
              const start = beginResize(sel, s.doc, i as 0 | 1 | 2 | 3)
              if (start) {
                resizeSession.current = { id: sel.id, start }
                s.beginGesture()
                gestureStarted.current = true
                return
              }
            }
          }
          if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
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
          cancelToolSession()
          const o = origin(viewRef.current)
          const sel = s.selectedId ? findLayer(s.doc, s.side, s.selectedId) : undefined

          // select mode with a selection: two fingers transform the layer
          if (toolRef.current.mode === 'select' && sel && !sel.locked) {
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
              resizeSession.current = null
              return
            }
            const next = applyPinch(pinchStart.current, a, b)
            sessionTransformed.current = true
            s.updateLayer(sel.id, (l) => void (l.transform = next), { transient: true })
            return
          }

          // otherwise: two fingers zoom/pan the canvas
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

        if (resizeSession.current) {
          const rs = resizeSession.current
          const next = applyResize(
            rs.start,
            docPoint(e.nativeEvent.locationX, e.nativeEvent.locationY),
          )
          sessionTransformed.current = true
          s.updateLayer(rs.id, (l) => void (l.transform = next), { transient: true })
          return
        }

        if (drawSession.current) {
          moveDraw(docPoint(e.nativeEvent.locationX, e.nativeEvent.locationY))
          return
        }
        if (eraseSession.current) {
          eraseAt(docPoint(e.nativeEvent.locationX, e.nativeEvent.locationY))
          return
        }
        if (stampSession.current) {
          moveStamp(docPoint(e.nativeEvent.locationX, e.nativeEvent.locationY))
          return
        }

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
          setView(
            clampView(panFrom.current.scale, panFrom.current.x + g.dx, panFrom.current.y + g.dy),
          )
        }
      },
      onPanResponderRelease: (e, g) => {
        const pinched = pinchStart.current !== null || canvasPinch.current !== null
        drag.current = null
        resizeSession.current = null
        pinchStart.current = null
        pinchLayerId.current = null
        canvasPinch.current = null
        panFrom.current = null
        if (drawSession.current) {
          endDraw()
          return
        }
        if (stampSession.current || eraseSession.current) {
          stampSession.current = null
          eraseSession.current = null
          return
        }
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
        const p = docPoint(vx, vy)
        const hit = hitTest(s.doc, s.side, p.x, p.y, { shapeContains: makeShapeContains(s.doc) })
        s.select(hit ? hit.id : null)
      },
      onPanResponderTerminate: () => {
        drag.current = null
        resizeSession.current = null
        pinchStart.current = null
        pinchLayerId.current = null
        canvasPinch.current = null
        panFrom.current = null
        drawSession.current = null
        stampSession.current = null
        eraseSession.current = null
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
            <Feather name="corner-up-left" size={16} color={canUndo ? '#c9d6ea' : '#3d4560'} />
          </Pressable>
          <Pressable
            style={styles.toolButton}
            hitSlop={6}
            disabled={!canRedo}
            onPress={() => useEditor.getState().redo()}
          >
            <Feather name="corner-up-right" size={16} color={canRedo ? '#c9d6ea' : '#3d4560'} />
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
            <EditorCanvas
              canvasRef={canvasRef}
              width={area.w}
              height={area.h}
              originX={originX}
              originY={originY}
              doc={doc}
              side={side}
              assets={assets}
              scale={total}
              sweep={fxOpen}
            />
            {selectionBox && !eyedropping && mode === 'select' ? (
              <>
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
                {!selected?.locked
                  ? (
                      [
                        [selectionBox.x, selectionBox.y],
                        [selectionBox.x + selectionBox.w, selectionBox.y],
                        [selectionBox.x, selectionBox.y + selectionBox.h],
                        [selectionBox.x + selectionBox.w, selectionBox.y + selectionBox.h],
                      ] as [number, number][]
                    ).map(([cx, cy], i) => (
                      <View
                        key={i}
                        pointerEvents="none"
                        style={[
                          styles.handle,
                          { left: cx * total + originX - 7, top: cy * total + originY - 7 },
                        ]}
                      />
                    ))
                  : null}
              </>
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

      <ToolBar
        mode={mode}
        onMode={setMode}
        draw={draw}
        onDraw={(patch) => setDraw((d) => ({ ...d, ...patch }))}
        stamp={stamp}
        onStamp={(patch) => setStamp((st) => ({ ...st, ...patch }))}
        shapes={allShapes}
        onOpenColor={openPicker}
        onNewLayer={() => useEditor.getState().select(null)}
        onOpenBuilder={() => {
          builderOrigin.current = 'stamp'
          setBuilderOpen(true)
        }}
      />

      {selected && mode === 'select' ? (
        <View style={styles.propsBar}>
          <Text style={styles.propsName} numberOfLines={1}>
            {selected.name}
          </Text>
          <Text style={styles.propsInfo}>
            {Math.round(selected.transform.rotation)}° · ×
            {(((Math.abs(selected.transform.scaleX) + Math.abs(selected.transform.scaleY)) / 2)).toFixed(2)}
          </Text>
          {selected.type === 'text' ? (
            <Pressable style={styles.propsAction} hitSlop={6} onPress={() => setTextOpen(true)}>
              <Text style={styles.propsActionText}>Edit</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.propsAction} hitSlop={6} onPress={() => setMaskOpen(true)}>
            <Text style={styles.propsActionText}>{selected.mask ? 'Mask ●' : 'Mask'}</Text>
          </Pressable>
          <Pressable style={styles.propsAction} hitSlop={6} onPress={() => setFxOpen(true)}>
            <Text style={styles.propsActionText}>{selected.finish ? 'FX ●' : 'FX'}</Text>
          </Pressable>
          {selectedColor ? (
            <Pressable style={styles.colorChipBack} hitSlop={6} onPress={() => openPicker('layer')}>
              <View style={[styles.colorChip, { backgroundColor: selectedColor }]} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <LayerPanel onAddPress={() => setAddOpen(true)} />

      {addOpen ? (
        <AddSheet
          onClose={() => setAddOpen(false)}
          onOpenBuilder={() => {
            setAddOpen(false)
            builderOrigin.current = 'add'
            setBuilderOpen(true)
          }}
        />
      ) : null}

      {eyedropping ? (
        <View style={styles.eyedropBanner} pointerEvents="box-none">
          <Text style={styles.eyedropText}>Tap the card to sample a color</Text>
          <Pressable hitSlop={8} onPress={() => setEyedropping(false)}>
            <Text style={styles.eyedropCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {pickerOpen && !eyedropping && pickerColor ? (
        <ColorPicker
          value={pickerColor}
          onChange={applyColor}
          onGestureStart={() => {
            if (pickerTargetRef.current === 'layer') useEditor.getState().beginGesture()
          }}
          onClose={closePicker}
          onEyedropper={() => setEyedropping(true)}
        />
      ) : null}

      {maskOpen && selected ? (
        <MaskEditor layerId={selected.id} onClose={() => setMaskOpen(false)} />
      ) : null}

      {fxOpen && selected ? (
        <FinishEditor layerId={selected.id} onClose={() => setFxOpen(false)} />
      ) : null}

      {textOpen && selected?.type === 'text' ? (
        <TextEditor layerId={selected.id} onClose={() => setTextOpen(false)} />
      ) : null}

      {builderOpen ? (
        <ShapeBuilder
          onClose={() => setBuilderOpen(false)}
          onSaved={(shapeId) => {
            setBuilderOpen(false)
            if (builderOrigin.current === 'add') {
              useEditor.getState().addLayer(makeShapeLayer(shapeId, { color: '#c9d6ea' }))
            } else {
              setModeState('stamp')
              setStamp((st) => ({ ...st, shapeId }))
            }
          }}
        />
      ) : null}
    </View>
  )
}

// The card canvas, isolated so the finish-sheet tilt sweep re-renders ONLY
// this subtree at display rate (rAF-driven, vsync-aligned) — sweeping from
// the parent re-rendered the whole editor per frame and looked jittery.
function EditorCanvas({
  canvasRef,
  width,
  height,
  originX,
  originY,
  doc,
  side,
  assets,
  scale,
  sweep,
}: {
  canvasRef: ReturnType<typeof useCanvasRef>
  width: number
  height: number
  originX: number
  originY: number
  doc: Parameters<typeof CardRenderer>[0]['doc']
  side: 'front' | 'back'
  assets: Parameters<typeof CardRenderer>[0]['assets']
  scale: number
  sweep: boolean
}) {
  const [tilt, setTilt] = useState<ViewState>(defaultViewState())
  useEffect(() => {
    if (!sweep) {
      setTilt(defaultViewState())
      return
    }
    let raf = 0
    const start = Date.now()
    const loop = () => {
      const t = (Date.now() - start) / 1000
      const tiltX = Math.sin(t * 0.22) * 0.28
      const tiltY = Math.cos(t * 0.16) * 0.2
      setTilt({ tiltX, tiltY, ...lightFromTilt(tiltX, tiltY) })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [sweep])

  return (
    <Canvas ref={canvasRef} style={{ width, height }}>
      <Group transform={[{ translateX: originX }, { translateY: originY }]}>
        <CardRenderer doc={doc} side={side} viewState={tilt} assets={assets} scale={scale} />
      </Group>
    </Canvas>
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
  handle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#4da3ff',
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
  propsAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1c2233',
  },
  propsActionText: { color: '#c9d6ea', fontSize: 12 },
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
