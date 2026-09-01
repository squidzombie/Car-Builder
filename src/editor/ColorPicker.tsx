import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { Canvas, Circle, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia'
import type { Color } from '../model/types'
import {
  type Hsva,
  hexToHsva,
  hsvaToHex,
  isValidHexInput,
  normalizeHexInput,
  rgbaToHex,
  hsvToRgb,
} from '../model/color'
import { useEditor } from '../state/useEditor'
import { STARTER_PALETTES } from '../model/starterPalettes'
import { Sheet } from './Sheet'
import { Feather } from '@expo/vector-icons'

// Color picker (CLAUDE.md §6): hue wheel + saturation/value square, hex
// input, alpha slider, pinned swatches, recents, eyedropper. Rendered as a
// bottom sheet over the editor. Wheel/slider drags are transient store
// updates inside one gesture, so a whole drag is one undo step.

const RING_W = 30
const SLIDER_H = 26

type Props = {
  value: Color
  /** transient=true while a wheel/slider drag is in flight */
  onChange: (color: Color, transient: boolean) => void
  /** called before the first transient update of a drag (undo grouping) */
  onGestureStart: () => void
  onClose: () => void
  onEyedropper: () => void
}

export function ColorPicker({ value, onChange, onGestureStart, onClose, onEyedropper }: Props) {
  const { width: screenW } = useWindowDimensions()
  const wheelSize = Math.min(screenW - 64, 240)
  const sliderW = Math.min(screenW - 48, 300)

  const pinned = useEditor((s) => s.doc.palette.pinned)
  const recents = useEditor((s) => s.doc.palette.recents)

  const [hsva, setHsva] = useState<Hsva>(() => hexToHsva(value))
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const hex = hsvaToHex(hsva)

  // The pan responders below are memoized, so route everything they touch
  // through refs — state via hsvaRef, parent callbacks via callback refs.
  const hsvaRef = useRef(hsva)
  hsvaRef.current = hsva
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onGestureStartRef = useRef(onGestureStart)
  onGestureStartRef.current = onGestureStart

  // resync when the color changes underneath us (eyedropper result, undo)
  useEffect(() => {
    if (value !== hsvaToHex(hsvaRef.current)) setHsva(hexToHsva(value))
  }, [value])

  const update = (next: Hsva, transient: boolean) => {
    setHsva(next)
    setHexDraft(null)
    onChangeRef.current(hsvaToHex(next), transient)
  }

  // ---- hue ring + SV square geometry ----
  const cx = wheelSize / 2
  const cy = wheelSize / 2
  const outerR = wheelSize / 2
  const innerR = outerR - RING_W
  const sqSide = Math.floor((innerR - 8) * Math.SQRT2)
  const sqX = cx - sqSide / 2
  const sqY = cy - sqSide / 2

  const wheelMode = useRef<'hue' | 'sv' | null>(null)
  const wheelPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const x = e.nativeEvent.locationX
          const y = e.nativeEvent.locationY
          const r = Math.hypot(x - cx, y - cy)
          if (x >= sqX && x <= sqX + sqSide && y >= sqY && y <= sqY + sqSide) {
            wheelMode.current = 'sv'
          } else if (r >= innerR - 6 && r <= outerR + 10) {
            wheelMode.current = 'hue'
          } else {
            wheelMode.current = null
            return
          }
          onGestureStartRef.current()
          applyWheelTouch(x, y)
        },
        onPanResponderMove: (e) => {
          if (!wheelMode.current) return
          applyWheelTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)
        },
        onPanResponderRelease: () => {
          wheelMode.current = null
        },
        onPanResponderTerminate: () => {
          wheelMode.current = null
        },
      }),
    // geometry is stable per wheelSize; handlers read state via refs
    [wheelSize],
  )

  const applyWheelTouch = (x: number, y: number) => {
    const cur = hsvaRef.current
    if (wheelMode.current === 'hue') {
      const deg = (Math.atan2(y - cy, x - cx) * 180) / Math.PI
      update({ ...cur, h: (deg + 360) % 360 }, true)
    } else if (wheelMode.current === 'sv') {
      const s = Math.max(0, Math.min(1, (x - sqX) / sqSide))
      const v = Math.max(0, Math.min(1, 1 - (y - sqY) / sqSide))
      update({ ...cur, s, v }, true)
    }
  }

  // ---- alpha slider ----
  const alphaActive = useRef(false)
  const alphaPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          alphaActive.current = true
          onGestureStartRef.current()
          applyAlphaTouch(e.nativeEvent.locationX)
        },
        onPanResponderMove: (e) => {
          if (alphaActive.current) applyAlphaTouch(e.nativeEvent.locationX)
        },
        onPanResponderRelease: () => {
          alphaActive.current = false
        },
        onPanResponderTerminate: () => {
          alphaActive.current = false
        },
      }),
    [sliderW],
  )

  const applyAlphaTouch = (x: number) => {
    const a = Math.max(0, Math.min(1, x / sliderW))
    update({ ...hsvaRef.current, a }, true)
  }

  const applyHexDraft = () => {
    if (hexDraft !== null && isValidHexInput(hexDraft)) {
      update(hexToHsva(normalizeHexInput(hexDraft)), false)
    } else {
      setHexDraft(null)
    }
  }

  const pickSwatch = (color: Color) => update(hexToHsva(color), false)

  const isPinned = pinned.includes(hex)
  const togglePin = () => {
    const s = useEditor.getState()
    if (isPinned) s.unpinColor(hex)
    else s.pinColor(hex)
  }

  // hue thumb position + gradient endpoints
  const hueRad = (hsva.h * Math.PI) / 180
  const thumbR = innerR + RING_W / 2
  const [pr, pg, pb] = hsvToRgb(hsva.h, 1, 1)
  const pureHue = rgbaToHex(pr, pg, pb)

  // Hue ring as solid arc segments (SweepGradient on a stroked circle
  // renders unreliably on some Android GPUs — first device test)
  const ringSegments = useMemo(() => {
    const STEP = 5
    const segs: { path: string; color: string }[] = []
    for (let deg = 0; deg < 360; deg += STEP) {
      const a0 = ((deg - 0.6) * Math.PI) / 180
      const a1 = ((deg + STEP + 0.6) * Math.PI) / 180
      const [r, g, b] = hsvToRgb(deg + STEP / 2, 1, 1)
      segs.push({
        path: `M ${cx + Math.cos(a0) * thumbR} ${cy + Math.sin(a0) * thumbR} A ${thumbR} ${thumbR} 0 0 1 ${cx + Math.cos(a1) * thumbR} ${cy + Math.sin(a1) * thumbR}`,
        color: rgbaToHex(r, g, b),
      })
    }
    return segs
  }, [cx, cy, thumbR])

  const checker = useMemo(() => {
    const cells: { x: number; y: number }[] = []
    const size = SLIDER_H / 2
    for (let i = 0; i * size < sliderW; i++) {
      cells.push({ x: i * size, y: i % 2 === 0 ? 0 : size })
    }
    return { cells, size }
  }, [sliderW])

  return (
    <Sheet title="Color" onClose={onClose} backdrop>
      <View style={styles.headerRow}>
          <View style={[styles.previewBack]}>
            <View style={[styles.preview, { backgroundColor: hex }]} />
          </View>
          <TextInput
            style={styles.hexInput}
            value={hexDraft ?? hex}
            onChangeText={setHexDraft}
            onSubmitEditing={applyHexDraft}
            onBlur={applyHexDraft}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.headerButton} hitSlop={6} onPress={togglePin}>
            <Feather name="bookmark" size={17} color={isPinned ? '#ffd166' : '#c9d6ea'} />
          </Pressable>
          <Pressable style={styles.headerButton} hitSlop={6} onPress={onEyedropper}>
            <Feather name="crosshair" size={17} color="#c9d6ea" />
          </Pressable>
        </View>

        <View style={styles.wheelRow}>
          <View style={{ width: wheelSize, height: wheelSize }} {...wheelPan.panHandlers}>
            <Canvas style={{ width: wheelSize, height: wheelSize }}>
              {ringSegments.map((seg, i) => (
                <Path
                  key={i}
                  path={seg.path}
                  style="stroke"
                  strokeWidth={RING_W}
                  color={seg.color}
                />
              ))}
              {/* SV square: pure hue, then white→transparent (S), then transparent→black (V) */}
              <Rect x={sqX} y={sqY} width={sqSide} height={sqSide} color={pureHue} />
              <Rect x={sqX} y={sqY} width={sqSide} height={sqSide}>
                <LinearGradient
                  start={vec(sqX, sqY)}
                  end={vec(sqX + sqSide, sqY)}
                  colors={['#ffffff', '#ffffff00']}
                />
              </Rect>
              <Rect x={sqX} y={sqY} width={sqSide} height={sqSide}>
                <LinearGradient
                  start={vec(sqX, sqY)}
                  end={vec(sqX, sqY + sqSide)}
                  colors={['#00000000', '#000000']}
                />
              </Rect>
              {/* thumbs */}
              <Circle
                cx={cx + Math.cos(hueRad) * thumbR}
                cy={cy + Math.sin(hueRad) * thumbR}
                r={9}
                style="stroke"
                strokeWidth={3}
                color="#ffffff"
              />
              <Circle
                cx={sqX + hsva.s * sqSide}
                cy={sqY + (1 - hsva.v) * sqSide}
                r={8}
                style="stroke"
                strokeWidth={3}
                color={hsva.v > 0.6 && hsva.s < 0.5 ? '#00000088' : '#ffffff'}
              />
            </Canvas>
          </View>
        </View>

        <View style={styles.sliderRow}>
          <View style={{ width: sliderW, height: SLIDER_H }} {...alphaPan.panHandlers}>
            <Canvas style={{ width: sliderW, height: SLIDER_H, borderRadius: 8 }}>
              <Rect x={0} y={0} width={sliderW} height={SLIDER_H} color="#ffffff" />
              {checker.cells.map((c, i) => (
                <Rect
                  key={i}
                  x={c.x}
                  y={c.y}
                  width={checker.size}
                  height={checker.size}
                  color="#b9bfcc"
                />
              ))}
              <Rect x={0} y={0} width={sliderW} height={SLIDER_H}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(sliderW, 0)}
                  colors={[
                    rgbaToHex(...hsvToRgb(hsva.h, hsva.s, hsva.v)) + '00',
                    rgbaToHex(...hsvToRgb(hsva.h, hsva.s, hsva.v)),
                  ]}
                />
              </Rect>
              <Circle
                cx={Math.max(8, Math.min(sliderW - 8, hsva.a * sliderW))}
                cy={SLIDER_H / 2}
                r={8}
                style="stroke"
                strokeWidth={3}
                color="#ffffff"
              />
            </Canvas>
          </View>
        </View>

        <View style={styles.swatchSection}>
          <Text style={styles.swatchLabel}>Pinned · drag to reorder, hold to remove</Text>
          {pinned.length === 0 ? (
            <Text style={styles.swatchEmpty}>☆ pins the current color</Text>
          ) : (
            <PinnedGrid colors={pinned} onPick={pickSwatch} />
          )}
        </View>
        <SwatchRow
          label="Recent · hold to pin"
          colors={recents}
          emptyHint="colors you use land here"
          onPick={pickSwatch}
          onLongPress={(c) => useEditor.getState().pinColor(c)}
        />
        <View style={styles.swatchSection}>
          <Text style={styles.swatchLabel}>Starter palettes · tap to add to pins</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.swatchStrip}>
              {STARTER_PALETTES.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.paletteChip}
                  onPress={() => useEditor.getState().loadPalette(p.colors)}
                >
                  <Text style={styles.paletteName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View style={styles.paletteDots}>
                    {p.colors.map((c) => (
                      <View key={c} style={[styles.paletteDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
    </Sheet>
  )
}

// Pinned swatches as a wrap grid with drag-to-reorder (§6). Tap applies,
// hold ~450ms removes the pin, dragging past slop lifts the swatch and
// drops it at the hovered slot (committed as one undo step on release).
// 30px swatchBack + 8px grid gap:
const PIN_SLOT = 38

function PinnedGrid({ colors, onPick }: { colors: Color[]; onPick: (c: Color) => void }) {
  const [drag, setDrag] = useState<{ from: number; dx: number; dy: number } | null>(null)
  const colorsRef = useRef(colors)
  colorsRef.current = colors
  const cols = useRef(1)

  // Everything is computed from the swatch's own index plus the gesture's
  // RELATIVE dx/dy — never from absolute window coordinates. On Android,
  // measureInWindow and touch pageY disagree by the status-bar inset
  // (~54dp on a Pixel 7), which silently broke the previous approach.
  const targetIndex = (from: number, dx: number, dy: number) => {
    const c = cols.current
    const len = colorsRef.current.length
    const maxRow = Math.floor((len - 1) / c)
    const col = Math.max(0, Math.min(c - 1, (from % c) + Math.round(dx / PIN_SLOT)))
    const row = Math.max(0, Math.min(maxRow, Math.floor(from / c) + Math.round(dy / PIN_SLOT)))
    return Math.min(row * c + col, len - 1)
  }

  const hover = drag ? targetIndex(drag.from, drag.dx, drag.dy) : -1

  return (
    <View
      style={styles.pinGrid}
      onLayout={(e) =>
        (cols.current = Math.max(1, Math.floor((e.nativeEvent.layout.width + 8) / PIN_SLOT)))
      }
    >
      {colors.map((c, i) => (
        <PinSwatch
          key={`${c}-${i}`}
          color={c}
          lifted={drag?.from === i}
          hovered={hover === i && drag !== null && drag.from !== i}
          dragOffset={drag?.from === i ? { dx: drag.dx, dy: drag.dy } : null}
          onTap={() => onPick(colorsRef.current[i])}
          onHold={() => useEditor.getState().unpinColor(colorsRef.current[i])}
          onDragMove={(dx, dy) => setDrag({ from: i, dx, dy })}
          onDragEnd={(dx, dy) => {
            setDrag(null)
            const to = targetIndex(i, dx, dy)
            if (to !== i) useEditor.getState().reorderPins(i, to)
          }}
          onCancel={() => setDrag(null)}
        />
      ))}
    </View>
  )
}

function PinSwatch({
  color,
  lifted,
  hovered,
  dragOffset,
  onTap,
  onHold,
  onDragMove,
  onDragEnd,
  onCancel,
}: {
  color: Color
  lifted: boolean
  hovered: boolean
  dragOffset: { dx: number; dy: number } | null
  onTap: () => void
  onHold: () => void
  onDragMove: (dx: number, dy: number) => void
  onDragEnd: (dx: number, dy: number) => void
  onCancel: () => void
}) {
  // latest callbacks for the memoized responder
  const cb = useRef({ onTap, onHold, onDragMove, onDragEnd, onCancel })
  cb.current = { onTap, onHold, onDragMove, onDragEnd, onCancel }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const state = useRef<{ dragging: boolean; consumed: boolean }>({ dragging: false, consumed: false })

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          state.current = { dragging: false, consumed: false }
          timer.current = setTimeout(() => {
            if (!state.current.dragging && !state.current.consumed) {
              state.current.consumed = true
              cb.current.onHold()
            }
          }, 450)
        },
        onPanResponderMove: (_e, g) => {
          if (state.current.consumed) return
          if (!state.current.dragging && Math.abs(g.dx) <= 6 && Math.abs(g.dy) <= 6) return
          clearTimer()
          state.current.dragging = true
          cb.current.onDragMove(g.dx, g.dy)
        },
        onPanResponderRelease: (_e, g) => {
          clearTimer()
          if (state.current.consumed) return
          if (state.current.dragging) cb.current.onDragEnd(g.dx, g.dy)
          else cb.current.onTap()
        },
        onPanResponderTerminate: () => {
          clearTimer()
          if (state.current.dragging) cb.current.onCancel()
        },
      }),
    [],
  )

  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.swatchBack,
        hovered && styles.pinHover,
        lifted && dragOffset
          ? [
              styles.pinFloating,
              { transform: [{ translateX: dragOffset.dx }, { translateY: dragOffset.dy }, { scale: 1.15 }] },
            ]
          : null,
      ]}
    >
      <View style={[styles.swatch, { backgroundColor: color }]} />
    </View>
  )
}

function SwatchRow({
  label,
  colors,
  emptyHint,
  onPick,
  onLongPress,
}: {
  label: string
  colors: Color[]
  emptyHint: string
  onPick: (c: Color) => void
  onLongPress: (c: Color) => void
}) {
  return (
    <View style={styles.swatchSection}>
      <Text style={styles.swatchLabel}>{label}</Text>
      {colors.length === 0 ? (
        <Text style={styles.swatchEmpty}>{emptyHint}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.swatchStrip}>
            {colors.map((c) => (
              <Pressable
                key={c}
                onPress={() => onPick(c)}
                onLongPress={() => onLongPress(c)}
                style={styles.swatchBack}
              >
                <View style={[styles.swatch, { backgroundColor: c }]} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewBack: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
    overflow: 'hidden',
  },
  preview: { flex: 1 },
  hexInput: {
    flex: 1,
    color: '#e6ecf7',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    backgroundColor: '#1c2233',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1c2233',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelRow: { alignItems: 'center', paddingVertical: 2 },
  sliderRow: { alignItems: 'center', paddingVertical: 4 },
  swatchSection: { paddingTop: 4 },
  swatchLabel: { color: '#7f8db0', fontSize: 12, marginBottom: 6 },
  swatchEmpty: { color: '#3d4560', fontSize: 12, paddingVertical: 6 },
  swatchStrip: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  swatchBack: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a3554',
  },
  swatch: { flex: 1 },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 2 },
  pinHover: { borderColor: '#4da3ff', borderWidth: 2 },
  pinFloating: {
    borderColor: '#ffffff',
    elevation: 6,
    zIndex: 10,
  },
  paletteChip: {
    backgroundColor: '#1c2233',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 5,
    width: 118,
  },
  paletteName: { color: '#c9d6ea', fontSize: 11 },
  paletteDots: { flexDirection: 'row', gap: 4 },
  paletteDot: { width: 14, height: 14, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#3d4a6e' },
})
