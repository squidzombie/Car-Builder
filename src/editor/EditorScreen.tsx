import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Canvas, Group, Skia, useCanvasRef } from '@shopify/react-native-skia'
import { useSharedValue } from 'react-native-reanimated'
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
  applyRotate,
  beginPinch,
  beginResize,
  beginRotate,
  pinchGeometry,
  ROTATE_HANDLE_SNAP_STEP,
  type PinchStart,
  type ResizeStart,
  type RotateStart,
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
import { AppearanceSheet, type AppearanceTab } from './AppearanceSheet'
import { useDocImages } from '../view/useDocImages'
import { pressHaptic, tick } from '../view/haptics'
import { getAssetUri, registerAsset, setAssetUri } from '../model/assets'
import { persistAsset } from '../model/storage'
import { cutoutAvailable, liftSubject } from '../native/subjectCutout'
import { ToolBar, type DrawSettings, type EditorMode, type StampSettings } from './ToolBar'
import { color, pressed, raised, type } from './theme'

// Editor screen (M2 core + M3 tools, CLAUDE.md §4).
// Select mode: tap-to-select, one-finger drag, two-finger pinch/twist on
// the selection — or, with nothing selected, two-finger canvas zoom/pan.
// Draw/stamp modes: one finger is the tool, two fingers always zoom/pan
// (an in-flight stroke cancels cleanly via undo).

const TAP_SLOP = 8
const MAX_ZOOM = 8

// rotate-handle placement (shared by the responder and the render):
// centered above the selection box, flipped below it near the top edge
const ROTATE_OFFSET = 26
function rotateHandlePos(
  b: { x: number; y: number; w: number; h: number },
  t: number,
  ox: number,
  oy: number,
) {
  const topY = b.y * t + oy
  const flip = topY - ROTATE_OFFSET < 10
  return {
    x: (b.x + b.w / 2) * t + ox,
    y: flip ? (b.y + b.h) * t + oy + ROTATE_OFFSET : topY - ROTATE_OFFSET,
    flip,
  }
}

type CanvasView = { scale: number; x: number; y: number }
type PickerTarget = 'layer' | 'draw' | 'stamp'

/** What the editor should do on open: 'name' = select the name text and open its sheet. */
export type EditorIntent = 'name' | null

export function EditorScreen({
  onPreview,
  intent = null,
}: {
  onPreview: () => void
  intent?: EditorIntent
}) {
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
  // Appearance mode: color + finish + surface for the selected layer in
  // one sheet; the value is the tab it opened on (null = closed)
  const [appearance, setAppearance] = useState<AppearanceTab | null>(null)
  const appearanceTabRef = useRef<AppearanceTab>('color')

  // subject lift (iOS 17+ builds only; hidden elsewhere)
  const [cutoutState, setCutoutState] = useState<'idle' | 'working' | 'none'>('idle')
  const doCutout = async () => {
    const s = useEditor.getState()
    const sel = s.selectedId ? findLayer(s.doc, s.side, s.selectedId) : undefined
    if (!sel || sel.type !== 'image' || cutoutState === 'working') return
    const srcUri = getAssetUri(sel.image!.assetId)
    if (!srcUri) return
    setCutoutState('working')
    try {
      const outUri = await liftSubject(srcUri)
      if (outUri) {
        const assetId = registerAsset(outUri)
        persistAsset(outUri, assetId)
          .then((uri) => setAssetUri(assetId, uri))
          .catch(() => {})
        s.updateLayer(sel.id, (l) => {
          l.image!.assetId = assetId
          l.image!.cutout = 'subject'
        })
        tick()
        setCutoutState('idle')
      } else {
        setCutoutState('none')
        setTimeout(() => setCutoutState('idle'), 2000)
      }
    } catch {
      setCutoutState('idle')
    }
  }

  // photo-first quick flow: open on the name, ready to type
  useEffect(() => {
    if (intent !== 'name') return
    const s = useEditor.getState()
    const layers = s.doc[s.side].layers
    const name =
      layers.find((l) => l.type === 'text' && /name/i.test(l.name)) ??
      layers.find((l) => l.type === 'text')
    if (name) {
      s.select(name.id)
      setTextOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // (the finish-sheet tilt sweep lives inside EditorCanvas so its 60fps
  // state updates re-render only the canvas, not the whole screen)

  const allShapes = useMemo(() => [...BUILTIN_SHAPES, ...(doc.shapes ?? [])], [doc.shapes])
  const assets = useDocImages(doc)

  useEffect(() => {
    // the edited layer vanished (undo/delete) while a sheet was up
    if ((maskOpen || textOpen || appearance) && !selected) {
      setMaskOpen(false)
      setTextOpen(false)
      setAppearance(null)
    }
  }, [maskOpen, textOpen, appearance, selected])

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
    setAppearance(null)
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

  const openAppearance = () => {
    setPickerTarget('layer')
    pickerOpenColor.current = selectedColor
    setAppearance(appearanceTabRef.current)
  }

  const closeAppearance = () => {
    const current = pickerColorRef.current
    if (pickerTargetRef.current === 'layer' && current && current !== pickerOpenColor.current) {
      useEditor.getState().pushRecentColor(current)
    }
    setAppearance(null)
    setEyedropping(false)
  }

  /** Read one rendered pixel at view coordinates (§6 eyedropper). */
  const readPixel = (vx: number, vy: number): Color | null => {
    const rect = Skia.XYWHRect(Math.max(0, Math.floor(vx)), Math.max(0, Math.floor(vy)), 1, 1)
    const image = canvasRef.current?.makeImageSnapshot(rect)
    const pixels = image?.readPixels()
    if (!pixels || pixels.length < 3) return null
    const norm = pixels instanceof Float32Array ? (v: number) => v : (v: number) => v / 255
    return rgbaToHex(norm(pixels[0]), norm(pixels[1]), norm(pixels[2]))
  }

  const sampleAt = (vx: number, vy: number) => {
    setEyedropping(false)
    const hex = readPixel(vx, vy)
    if (hex) {
      tick()
      applyColor(hex, false)
    }
  }

  // loupe: the color under the finger, shown above it while aiming —
  // sampling is otherwise hidden under the fingertip
  const [loupe, setLoupe] = useState<{ x: number; y: number; hex: Color } | null>(null)
  const loupeAt = useRef(0)
  const moveLoupe = (vx: number, vy: number) => {
    const now = Date.now()
    if (now - loupeAt.current < 32) return
    loupeAt.current = now
    const hex = readPixel(vx, vy)
    if (hex) setLoupe({ x: vx, y: vy, hex })
  }

  // ---- canvas gestures ----
  // All gesture state lives in refs — responder callbacks must not close
  // over stale render values. One responder session = one undo step.
  const drag = useRef<{
    id: string
    startX: number
    startY: number
    /** bounds center at drag start (doc space) */
    cx: number
    cy: number
    /** alignment lines to snap to: card center + other layers' centers */
    linesX: number[]
    linesY: number[]
  } | null>(null)
  // snapping guides drawn while a drag is magnetized (doc-space lines)
  const [guides, setGuides] = useState<{ v: number | null; h: number | null } | null>(null)
  const guideRef = useRef<{ v: number | null; h: number | null } | null>(null)
  const setGuideLines = (v: number | null, h: number | null) => {
    const cur = guideRef.current
    if (v === null && h === null) {
      if (cur) {
        guideRef.current = null
        setGuides(null)
      }
      return
    }
    if (!cur || cur.v !== v || cur.h !== h) {
      // a tick the moment a new line catches
      if ((v !== null && cur?.v !== v) || (h !== null && cur?.h !== h)) tick()
      guideRef.current = { v, h }
      setGuides({ v, h })
    }
  }
  const resizeSession = useRef<{ id: string; start: ResizeStart } | null>(null)
  const rotateSession = useRef<{ id: string; start: RotateStart } | null>(null)
  const pinchStart = useRef<PinchStart | null>(null)
  const pinchLayerId = useRef<string | null>(null)
  const gestureStarted = useRef(false)
  const sessionTransformed = useRef(false)
  const wasSnapped = useRef(false)
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
        rotateSession.current = null
        drawSession.current = null
        stampSession.current = null
        eraseSession.current = null
        panFrom.current = { ...viewRef.current }
        if (eyedroppingRef.current) {
          moveLoupe(e.nativeEvent.locationX, e.nativeEvent.locationY)
          return
        }
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
          // rotate handle above the box → rotate about the center
          const rp = rotateHandlePos(b, o.t, o.x, o.y)
          if (Math.hypot(vx - rp.x, vy - rp.y) < 22) {
            const start = beginRotate(sel, s.doc, docPoint(vx, vy))
            if (start) {
              rotateSession.current = { id: sel.id, start }
              s.beginGesture()
              gestureStarted.current = true
              return
            }
          }
          const corners: [number, number][] = [
            [b.x, b.y],
            [b.x + b.w, b.y],
            [b.x, b.y + b.h],
            [b.x + b.w, b.y + b.h],
          ]
          // on small layers the four 24px hit zones would swallow the
          // move-drag area — fall back to a single bottom-right handle
          const small = Math.min(b.w, b.h) * o.t < 56
          for (let i = small ? 3 : 0; i < 4; i++) {
            const hx = corners[i][0] * o.t + o.x
            const hy = corners[i][1] * o.t + o.y
            if (Math.hypot(vx - hx, vy - hy) < (small ? 20 : 24)) {
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
            const linesX = [docW / 2]
            const linesY = [docH / 2]
            for (const other of s.doc[s.side].layers) {
              if (other.id === sel.id || !other.visible || other.type === 'fill') continue
              const ob = layerBounds(other, s.doc)
              linesX.push(ob.x + ob.w / 2)
              linesY.push(ob.y + ob.h / 2)
            }
            drag.current = {
              id: sel.id,
              startX: sel.transform.x,
              startY: sel.transform.y,
              cx: b.x + b.w / 2,
              cy: b.y + b.h / 2,
              linesX,
              linesY,
            }
            s.beginGesture()
            gestureStarted.current = true
          }
        }
      },
      onPanResponderMove: (e, g) => {
        if (eyedroppingRef.current) {
          moveLoupe(e.nativeEvent.locationX, e.nativeEvent.locationY)
          return
        }
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
              rotateSession.current = null
              return
            }
            const next = applyPinch(pinchStart.current, a, b)
            // a tick the moment the twist snaps onto a cardinal angle
            const snapped = next.rotation % 90 === 0
            if (snapped && !wasSnapped.current) tick()
            wasSnapped.current = snapped
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

        if (rotateSession.current) {
          const rs = rotateSession.current
          const next = applyRotate(
            rs.start,
            docPoint(e.nativeEvent.locationX, e.nativeEvent.locationY),
          )
          const snapped = next.rotation % ROTATE_HANDLE_SNAP_STEP === 0
          if (snapped && !wasSnapped.current) tick()
          wasSnapped.current = snapped
          sessionTransformed.current = true
          s.updateLayer(rs.id, (l) => void (l.transform = next), { transient: true })
          return
        }

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
          const { id, startX, startY, cx, cy, linesX, linesY } = drag.current
          let dx = g.dx / o.t
          let dy = g.dy / o.t
          // snapping: magnetize the layer's center to the card center or
          // another layer's center when within a few screen px
          const th = 8 / o.t
          let snapV: number | null = null
          let snapH: number | null = null
          let best = th
          for (const lx of linesX) {
            const d = Math.abs(cx + dx - lx)
            if (d < best) {
              best = d
              snapV = lx
            }
          }
          if (snapV !== null) dx += snapV - (cx + dx)
          best = th
          for (const ly of linesY) {
            const d = Math.abs(cy + dy - ly)
            if (d < best) {
              best = d
              snapH = ly
            }
          }
          if (snapH !== null) dy += snapH - (cy + dy)
          setGuideLines(snapV, snapH)
          sessionTransformed.current = true
          s.updateLayer(
            id,
            (l) => {
              l.transform.x = startX + dx
              l.transform.y = startY + dy
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
        if (eyedroppingRef.current) {
          setLoupe(null)
          sampleAt(e.nativeEvent.locationX, e.nativeEvent.locationY)
          return
        }
        const pinched = pinchStart.current !== null || canvasPinch.current !== null
        drag.current = null
        setGuideLines(null, null)
        resizeSession.current = null
        rotateSession.current = null
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
        const s = useEditor.getState()
        const p = docPoint(e.nativeEvent.locationX, e.nativeEvent.locationY)
        const hit = hitTest(s.doc, s.side, p.x, p.y, { shapeContains: makeShapeContains(s.doc) })
        if (hit && hit.id !== s.selectedId) tick()
        s.select(hit ? hit.id : null)
      },
      onPanResponderTerminate: () => {
        setLoupe(null)
        setGuideLines(null, null)
        drag.current = null
        resizeSession.current = null
        rotateSession.current = null
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
        <Pressable {...pressHaptic} style={pressed(styles.toolButton)} onPress={onPreview} hitSlop={6}>
          <Text style={styles.toolText}>Preview</Text>
        </Pressable>

        <View style={styles.sideSwitch}>
          {(['front', 'back'] as const).map((s) => (
            <Pressable {...pressHaptic}
              key={s}
              style={pressed(styles.sideOption, side === s && styles.sideOptionActive)}
              onPress={() => setSide(s)}
            >
              <Text style={[styles.sideText, side === s && styles.sideTextActive]}>
                {s === 'front' ? 'Front' : 'Back'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.historyButtons}>
          <Pressable {...pressHaptic}
            style={pressed(styles.toolButton)}
            hitSlop={6}
            disabled={!canUndo}
            onPress={() => useEditor.getState().undo()}
          >
            <Feather name="corner-up-left" size={16} color={canUndo ? color.textMid : color.textGhost} />
          </Pressable>
          <Pressable {...pressHaptic}
            style={pressed(styles.toolButton)}
            hitSlop={6}
            disabled={!canRedo}
            onPress={() => useEditor.getState().redo()}
          >
            <Feather name="corner-up-right" size={16} color={canRedo ? color.textMid : color.textGhost} />
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
              sweep={appearance === 'finish' || appearance === 'surface'}
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
                    )
                      .slice(Math.min(selectionBox.w, selectionBox.h) * total < 56 ? 3 : 0)
                      .map(([cx, cy], i) => (
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
                {!selected?.locked
                  ? (() => {
                      const rp = rotateHandlePos(selectionBox, total, originX, originY)
                      return (
                        <>
                          <View
                            pointerEvents="none"
                            style={[
                              styles.rotateStem,
                              { left: rp.x - 0.75, top: rp.flip ? rp.y - ROTATE_OFFSET : rp.y + 8 },
                            ]}
                          />
                          <View
                            pointerEvents="none"
                            style={[styles.rotateHandle, { left: rp.x - 8, top: rp.y - 8 }]}
                          />
                        </>
                      )
                    })()
                  : null}
              </>
            ) : null}
            {view.scale > 1 ? (
              <Pressable {...pressHaptic}
                style={pressed(styles.zoomChip)}
                hitSlop={6}
                onPress={() => setView({ scale: 1, x: 0, y: 0 })}
              >
                <Text style={styles.zoomChipText}>{Math.round(view.scale * 100)}% ⤢</Text>
              </Pressable>
            ) : null}
            {guides?.v !== null && guides?.v !== undefined ? (
              <View
                pointerEvents="none"
                style={[
                  styles.guideV,
                  { left: guides.v * total + originX, top: originY, height: docH * total },
                ]}
              />
            ) : null}
            {guides?.h !== null && guides?.h !== undefined ? (
              <View
                pointerEvents="none"
                style={[
                  styles.guideH,
                  { top: guides.h * total + originY, left: originX, width: docW * total },
                ]}
              />
            ) : null}
            {loupe ? (
              <View
                pointerEvents="none"
                style={[styles.loupe, { left: loupe.x - 27, top: Math.max(4, loupe.y - 92) }]}
              >
                <View style={[styles.loupeSwatch, { backgroundColor: loupe.hex }]} />
                <Text style={styles.loupeHex}>{loupe.hex}</Text>
              </View>
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
        drawTargetSelected={selected?.type === 'path'}
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
            <Pressable {...pressHaptic} style={pressed(styles.propsAction)} hitSlop={6} onPress={() => setTextOpen(true)}>
              <Text style={styles.propsActionText}>Edit</Text>
            </Pressable>
          ) : null}
          {selected.type === 'image' && cutoutAvailable() ? (
            <Pressable {...pressHaptic} style={pressed(styles.propsAction)} hitSlop={6} onPress={doCutout}>
              <Text style={styles.propsActionText}>
                {cutoutState === 'working'
                  ? 'Cutting…'
                  : cutoutState === 'none'
                    ? 'No subject'
                    : 'Cut out'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable {...pressHaptic} style={pressed(styles.propsAction)} hitSlop={6} onPress={() => setMaskOpen(true)}>
            <Text style={styles.propsActionText}>{selected.mask ? 'Mask ●' : 'Mask'}</Text>
          </Pressable>
          <Pressable {...pressHaptic} style={pressed(styles.propsAction, styles.appearanceAction)} hitSlop={6} onPress={openAppearance}>
            {selectedColor ? (
              <View style={styles.colorDotBack}>
                <View style={[styles.colorDot, { backgroundColor: selectedColor }]} />
              </View>
            ) : null}
            <Text style={styles.propsActionText}>
              {selected.finish || selected.emboss ? 'Appearance ●' : 'Appearance'}
            </Text>
          </Pressable>
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

      {appearance && selected && !eyedropping ? (
        <AppearanceSheet
          layerId={selected.id}
          initialTab={appearance}
          color={
            selectedColor
              ? {
                  value: selectedColor,
                  onChange: applyColor,
                  onGestureStart: () => useEditor.getState().beginGesture(),
                  onEyedropper: () => setEyedropping(true),
                }
              : null
          }
          onClose={closeAppearance}
          onTabChange={(t) => {
            appearanceTabRef.current = t
            setAppearance(t)
          }}
        />
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
  // shared value: the sweep writes it per frame with zero React renders;
  // the shaders read it on the UI thread (perf pass)
  const tilt = useSharedValue<ViewState>(defaultViewState())
  useEffect(() => {
    if (!sweep) {
      tilt.value = defaultViewState()
      return
    }
    let raf = 0
    const start = Date.now()
    const loop = () => {
      const t = (Date.now() - start) / 1000
      const tiltX = Math.sin(t * 0.22) * 0.28
      const tiltY = Math.cos(t * 0.16) * 0.2
      tilt.value = { tiltX, tiltY, ...lightFromTilt(tiltX, tiltY) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [sweep, tilt])

  return (
    <Canvas ref={canvasRef} style={{ width, height }}>
      <Group transform={[{ translateX: originX }, { translateY: originY }]}>
        <CardRenderer doc={doc} side={side} viewState={tilt} assets={assets} scale={scale} />
      </Group>
    </Canvas>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg0 },
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
    backgroundColor: color.chip,
    ...raised,
  },
  toolText: { color: color.textMid, fontSize: type.base },
  toolTextDisabled: { color: color.textGhost },
  historyButtons: { flexDirection: 'row', gap: 8 },
  sideSwitch: {
    flexDirection: 'row',
    backgroundColor: color.track,
    borderRadius: 16,
    padding: 2,
  },
  sideOption: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  sideOptionActive: { backgroundColor: color.chipActive, ...raised },
  sideText: { color: color.textDim, fontSize: type.md },
  sideTextActive: { color: color.accent, fontWeight: '600' },
  canvasArea: { flex: 1, overflow: 'hidden' },
  selection: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: color.accent,
    borderRadius: 3,
  },
  handle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: color.accent,
  },
  zoomChip: {
    // bottom-center: thumb-friendly, and resize handles live on CORNERS,
    // so the chip can no longer sit on top of one
    position: 'absolute',
    alignSelf: 'center',
    bottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: color.chipGlass,
    ...raised,
  },
  zoomChipText: { color: color.textMid, fontSize: type.sm, fontVariant: ['tabular-nums'] },
  propsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: color.bgBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
  propsName: { color: color.text, fontSize: type.md, flex: 1 },
  propsInfo: { color: color.textFaint, fontSize: type.sm, fontVariant: ['tabular-nums'] },
  propsAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: color.chip,
    ...raised,
  },
  propsActionText: { color: color.textMid, fontSize: type.sm },
  appearanceAction: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  colorDotBack: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: color.swatchBack,
    overflow: 'hidden',
  },
  colorDot: { flex: 1 },
  rotateHandle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: color.accent,
  },
  rotateStem: {
    position: 'absolute',
    width: 1.5,
    height: ROTATE_OFFSET - 8,
    backgroundColor: color.accent,
    opacity: 0.7,
  },
  guideV: { position: 'absolute', width: 1, backgroundColor: color.accent, opacity: 0.85 },
  guideH: { position: 'absolute', height: 1, backgroundColor: color.accent, opacity: 0.85 },
  loupe: { position: 'absolute', width: 54, alignItems: 'center', gap: 4 },
  loupeSwatch: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  loupeHex: {
    color: color.text,
    fontSize: type.xs,
    fontVariant: ['tabular-nums'],
    backgroundColor: color.chipGlass,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  eyedropBanner: {
    position: 'absolute',
    top: 108,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: color.chipGlass,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  eyedropText: { color: color.text, fontSize: type.md },
  eyedropCancel: { color: color.accent, fontSize: type.md, fontWeight: '600' },
})
