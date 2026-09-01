import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Canvas, FillType, Path, Skia } from '@shopify/react-native-skia'
import { MiniSlider } from './MiniSlider'
import type { Color } from '../model/types'
import type { Shape } from '../model/shapeTypes'
import {
  ROTATION_LABEL,
  ROTATION_ORDER,
  SYMMETRY_LABEL,
  SYMMETRY_ORDER,
  type RotationMode,
  type SymmetryMode,
} from './tools'
import { color, pressed, type } from './theme'

// M3 tool bar: mode switch plus per-mode options. Deliberately restrained
// styling — text labels and geometric glyphs, no emoji (user feedback).

export type EditorMode = 'select' | 'draw' | 'stamp'

export type DrawSettings = {
  width: number
  color: Color
  eraser: boolean
  symmetry: SymmetryMode
}

export type StampSettings = {
  shapeId: string
  size: number
  rotMode: RotationMode
  jitter: boolean
  color: Color
  symmetry: SymmetryMode
}

export const DRAW_WIDTHS = [6, 14, 28]
export const STAMP_SIZE_MIN = 16
export const STAMP_SIZE_MAX = 320

type Props = {
  mode: EditorMode
  onMode: (m: EditorMode) => void
  draw: DrawSettings
  onDraw: (patch: Partial<DrawSettings>) => void
  stamp: StampSettings
  onStamp: (patch: Partial<StampSettings>) => void
  shapes: Shape[]
  onOpenColor: (target: 'draw' | 'stamp') => void
  onNewLayer: () => void
  onOpenBuilder: () => void
  /** the eraser only works on a selected drawing — used for the hint */
  drawTargetSelected: boolean
}

export function ToolBar(p: Props) {
  const cycle = <T,>(order: readonly T[], cur: T): T => order[(order.indexOf(cur) + 1) % order.length]

  return (
    <View style={styles.bar}>
      <View style={styles.modeRow}>
        {(['select', 'draw', 'stamp'] as const).map((m) => (
          <Pressable
            key={m}
            style={pressed(styles.modeButton, p.mode === m && styles.modeButtonActive)}
            onPress={() => p.onMode(m)}
          >
            <Text style={[styles.modeText, p.mode === m && styles.modeTextActive]}>
              {m === 'select' ? 'Select' : m === 'draw' ? 'Draw' : 'Stamp'}
            </Text>
          </Pressable>
        ))}
      </View>

      {p.mode === 'draw' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.optionRow}>
            {DRAW_WIDTHS.map((w) => (
              <Pressable
                key={w}
                style={pressed(styles.option, p.draw.width === w && !p.draw.eraser && styles.optionActive)}
                onPress={() => p.onDraw({ width: w, eraser: false })}
              >
                <View
                  style={[
                    styles.widthDot,
                    { width: 6 + w / 2.5, height: 6 + w / 2.5, borderRadius: 20 },
                  ]}
                />
              </Pressable>
            ))}
            <Pressable style={pressed(styles.option)} onPress={() => p.onOpenColor('draw')}>
              <View style={[styles.colorDot, { backgroundColor: p.draw.color }]} />
            </Pressable>
            <Pressable
              style={pressed(styles.option, p.draw.eraser && styles.optionActive)}
              onPress={() => p.onDraw({ eraser: !p.draw.eraser })}
            >
              <Text style={styles.optionText}>Eraser</Text>
            </Pressable>
            <Pressable
              style={pressed(styles.option, p.draw.symmetry !== 'off' && styles.optionActive)}
              onPress={() => p.onDraw({ symmetry: cycle(SYMMETRY_ORDER, p.draw.symmetry) })}
            >
              <Text style={styles.optionText}>{SYMMETRY_LABEL[p.draw.symmetry]}</Text>
            </Pressable>
            <Pressable style={pressed(styles.option)} onPress={p.onNewLayer}>
              <Text style={styles.optionText}>New layer</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {p.mode === 'draw' && p.draw.eraser && !p.drawTargetSelected ? (
        <Text style={styles.hint}>Select a drawing in the layer list to erase from it</Text>
      ) : null}

      {p.mode === 'stamp' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.optionRow}>
              {p.shapes.map((s) => (
                <Pressable
                  key={s.id}
                  style={pressed(styles.option, p.stamp.shapeId === s.id && styles.optionActive)}
                  onPress={() => p.onStamp({ shapeId: s.id })}
                >
                  <ShapeGlyph shape={s} />
                </Pressable>
              ))}
              <Pressable style={pressed(styles.option)} onPress={p.onOpenBuilder}>
                <Text style={styles.optionText}>+ Shape</Text>
              </Pressable>
            </View>
          </ScrollView>
          <View style={styles.sizeRow}>
            <MiniSlider
              label={`Size · ${Math.round(p.stamp.size)}`}
              value={p.stamp.size}
              min={STAMP_SIZE_MIN}
              max={STAMP_SIZE_MAX}
              step={2}
              onChange={(v) => p.onStamp({ size: v })}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.optionRow}>
              <Pressable style={pressed(styles.option)} onPress={() => p.onOpenColor('stamp')}>
                <View style={[styles.colorDot, { backgroundColor: p.stamp.color }]} />
              </Pressable>
              <Pressable
                style={pressed(styles.option)}
                onPress={() => p.onStamp({ rotMode: cycle(ROTATION_ORDER, p.stamp.rotMode) })}
              >
                <Text style={styles.optionText}>{ROTATION_LABEL[p.stamp.rotMode]}</Text>
              </Pressable>
              <Pressable
                style={pressed(styles.option, p.stamp.jitter && styles.optionActive)}
                onPress={() => p.onStamp({ jitter: !p.stamp.jitter })}
              >
                <Text style={styles.optionText}>Jitter</Text>
              </Pressable>
              <Pressable
                style={pressed(styles.option, p.stamp.symmetry !== 'off' && styles.optionActive)}
                onPress={() => p.onStamp({ symmetry: cycle(SYMMETRY_ORDER, p.stamp.symmetry) })}
              >
                <Text style={styles.optionText}>{SYMMETRY_LABEL[p.stamp.symmetry]}</Text>
              </Pressable>
              <Pressable style={pressed(styles.option)} onPress={p.onNewLayer}>
                <Text style={styles.optionText}>New layer</Text>
              </Pressable>
            </View>
          </ScrollView>
        </>
      ) : null}
    </View>
  )
}

const GLYPH = 22

export function ShapeGlyph({ shape, size = GLYPH }: { shape: Shape; size?: number }) {
  // wide shapes (Rectangle) draw at their aspect, letterboxed in the tile
  const aspect = shape.defaultAspect ?? 1
  const gw = aspect >= 1 ? size : size * aspect
  const gh = gw / aspect
  const path = React.useMemo(() => {
    const sk = Skia.Path.MakeFromSVGString(shape.path)
    if (!sk) return null
    if (shape.fillRule === 'evenodd') sk.setFillType(FillType.EvenOdd)
    const m = Skia.Matrix()
    m.translate((size - gw) / 2, (size - gh) / 2)
    m.scale(gw, gh)
    sk.transform(m)
    return sk
  }, [shape.path, shape.fillRule, size, gw, gh])
  if (!path) return null
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={path} color={color.glyph} />
    </Canvas>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.bgBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    paddingVertical: 6,
    gap: 6,
  },
  modeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: color.track,
    borderRadius: 8,
    padding: 2,
  },
  modeButton: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 6 },
  modeButtonActive: { backgroundColor: color.chipActive },
  modeText: { color: color.textDim, fontSize: type.md },
  modeTextActive: { color: color.text, fontWeight: '600' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  sizeRow: { paddingHorizontal: 12 },
  option: {
    minWidth: 40,
    height: 34,
    borderRadius: 8,
    backgroundColor: color.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  optionActive: { backgroundColor: color.chipActive, borderWidth: 1, borderColor: color.accent },
  optionText: { color: color.textMid, fontSize: type.sm },
  hint: { color: color.warn, fontSize: type.xs, textAlign: 'center', paddingHorizontal: 16 },
  widthDot: { backgroundColor: color.textMid },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: color.hairlineBright,
  },
})
