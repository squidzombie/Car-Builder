import React, { useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { Canvas, Path } from '@shopify/react-native-skia'
import { buildDrawnShapePath, buildPolygonPath } from '../model/shapes'
import type { Shape } from '../model/shapeTypes'
import type { Point } from '../model/types'
import { useEditor } from '../state/useEditor'
import { newLayerId } from '../state/editorStore'
import { strokePathFromPoints } from '../renderer/strokePath'
import { ShapeGlyph } from './ToolBar'
import { MiniSlider } from './MiniSlider'
import { Sheet } from './Sheet'
import { color, pressed, radius, type } from './theme'

// Custom shape builder (CLAUDE.md §4). Two ways in:
// - Polygon: sides 3–24, optional star inset, corner rounding.
// - Draw: freehand strokes become a filled silhouette (evenodd, so inner
//   strokes punch holes) that keeps its drawn proportions.
// Saved shapes live in CardDocument.shapes so they travel with the card,
// and work everywhere a built-in does — layers, stamps, masks.

type Props = {
  onClose: () => void
  onSaved: (shapeId: string) => void
}

const PAD = 240

export function ShapeBuilder({ onClose, onSaved }: Props) {
  const [mode, setMode] = useState<'polygon' | 'draw'>('polygon')

  // ---- polygon controls ----
  const [sides, setSides] = useState(5)
  const [star, setStar] = useState(true)
  const [inset, setInset] = useState(0.5)
  const [rounding, setRounding] = useState(0)

  const polygonPath = useMemo(
    () =>
      buildPolygonPath({
        sides,
        insetRatio: star ? inset : undefined,
        cornerRadius: rounding,
      }),
    [sides, star, inset, rounding],
  )

  // ---- draw pad ----
  const [strokes, setStrokes] = useState<Point[][]>([])
  const [cur, setCur] = useState<Point[]>([])
  const curRef = useRef<Point[]>([])
  const clampPad = (v: number) => Math.max(0, Math.min(PAD, v))
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          curRef.current = [
            { x: clampPad(e.nativeEvent.locationX), y: clampPad(e.nativeEvent.locationY) },
          ]
          setCur(curRef.current)
        },
        onPanResponderMove: (e) => {
          const p = { x: clampPad(e.nativeEvent.locationX), y: clampPad(e.nativeEvent.locationY) }
          const last = curRef.current[curRef.current.length - 1]
          if (last && Math.hypot(p.x - last.x, p.y - last.y) < 3) return
          curRef.current = [...curRef.current, p]
          setCur(curRef.current)
        },
        onPanResponderRelease: () => {
          const done = curRef.current
          curRef.current = []
          setCur([])
          if (done.length >= 2) setStrokes((s) => [...s, done])
        },
        onPanResponderTerminate: () => {
          curRef.current = []
          setCur([])
        },
      }),
    [],
  )

  const drawn = useMemo(
    () => buildDrawnShapePath(cur.length >= 2 ? [...strokes, cur] : strokes),
    [strokes, cur],
  )

  const preview: Shape | null = useMemo(() => {
    if (mode === 'polygon') {
      return { id: 'preview', name: 'preview', path: polygonPath, builtIn: false }
    }
    if (!drawn) return null
    return {
      id: 'preview',
      name: 'preview',
      path: drawn.path,
      builtIn: false,
      fillRule: 'evenodd',
      defaultAspect: drawn.aspect,
    }
  }, [mode, polygonPath, drawn])

  const canSave = mode === 'polygon' || drawn !== null

  const save = () => {
    let shape: Shape
    if (mode === 'polygon') {
      shape = {
        id: newLayerId('shape-custom'),
        name: star ? `${sides}-point star` : `${sides}-gon`,
        path: polygonPath,
        builtIn: false,
      }
    } else {
      if (!drawn) return
      shape = {
        id: newLayerId('shape-custom'),
        name: 'Drawn shape',
        path: drawn.path,
        builtIn: false,
        fillRule: 'evenodd',
        defaultAspect: drawn.aspect,
      }
    }
    useEditor.getState().apply((doc) => {
      doc.shapes = [...(doc.shapes ?? []), shape]
    })
    onSaved(shape.id)
  }

  return (
    <Sheet
      title="Custom shape"
      onClose={onClose}
      closeLabel="Cancel"
      backdrop
      headerRight={
        <Pressable
          style={pressed(styles.saveButton, !canSave && styles.saveButtonDisabled)}
          hitSlop={8}
          disabled={!canSave}
          onPress={save}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      }
    >
      <View style={styles.tabRow}>
        {(['polygon', 'draw'] as const).map((m) => (
          <Pressable
            key={m}
            style={pressed(styles.tab, mode === m && styles.tabActive)}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
              {m === 'polygon' ? 'Polygon' : 'Draw'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'polygon' ? (
        <>
          <View style={styles.previewRow}>
            <View style={styles.previewBox}>
              {preview ? <ShapeGlyph shape={preview} size={96} /> : null}
            </View>
          </View>
          <MiniSlider
            label={`Sides · ${sides}`}
            value={sides}
            min={3}
            max={24}
            step={1}
            onChange={(v) => setSides(Math.round(v))}
          />
          <View style={styles.switchRow}>
            <Text style={styles.sliderLabel}>Star</Text>
            <Switch value={star} onValueChange={setStar} />
          </View>
          {star ? (
            <MiniSlider
              label={`Inset · ${inset.toFixed(2)}`}
              value={inset}
              min={0.2}
              max={0.9}
              onChange={setInset}
            />
          ) : null}
          <MiniSlider
            label={`Rounding · ${rounding.toFixed(2)}`}
            value={rounding}
            min={0}
            max={0.4}
            onChange={setRounding}
          />
        </>
      ) : (
        <>
          <View style={styles.drawRow}>
            <View style={styles.pad} {...pan.panHandlers}>
              <Canvas pointerEvents="none" style={styles.padCanvas}>
                {[...strokes, cur]
                  .filter((s) => s.length >= 2)
                  .map((s, i) => (
                    <Path
                      key={i}
                      path={strokePathFromPoints(s)}
                      style="stroke"
                      strokeWidth={3}
                      strokeCap="round"
                      strokeJoin="round"
                      color={color.glyph}
                    />
                  ))}
              </Canvas>
              {strokes.length === 0 && cur.length === 0 ? (
                <Text style={styles.padHint}>Draw an outline — each stroke closes into the shape</Text>
              ) : null}
            </View>
            <View style={styles.drawSide}>
              <View style={styles.previewBoxSmall}>
                {preview ? <ShapeGlyph shape={preview} size={64} /> : null}
              </View>
              <Pressable
                style={pressed(styles.clearButton)}
                hitSlop={6}
                disabled={strokes.length === 0}
                onPress={() => setStrokes([])}
              >
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  saveButton: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.35 },
  saveText: { color: color.onAccent, fontSize: type.base, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: color.track,
    borderRadius: radius.sm,
    padding: 2,
  },
  tab: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: radius.sm - 2 },
  tabActive: { backgroundColor: color.chipActive },
  tabText: { color: color.textDim, fontSize: type.md },
  tabTextActive: { color: color.text, fontWeight: '600' },
  previewRow: { alignItems: 'center' },
  previewBox: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: color.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  sliderLabel: { color: color.textDim, fontSize: type.sm },
  drawRow: { flexDirection: 'row', gap: 12, alignSelf: 'center', alignItems: 'flex-start' },
  pad: {
    width: PAD,
    height: PAD,
    borderRadius: radius.lg,
    backgroundColor: color.chip,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  padCanvas: { position: 'absolute', left: 0, top: 0, width: PAD, height: PAD },
  padHint: {
    color: color.textFaint,
    fontSize: type.sm,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  drawSide: { gap: 10, alignItems: 'center' },
  previewBoxSmall: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: color.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    minHeight: 34,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: color.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { color: color.textMid, fontSize: type.md },
})
