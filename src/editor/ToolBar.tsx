import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Canvas, Path, Skia } from '@shopify/react-native-skia'
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
import { pressed } from './theme'

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
export const STAMP_SIZES = [44, 84, 150]

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.optionRow}>
              {STAMP_SIZES.map((s, i) => (
                <Pressable
                  key={s}
                  style={pressed(styles.option, p.stamp.size === s && styles.optionActive)}
                  onPress={() => p.onStamp({ size: s })}
                >
                  <Text style={styles.optionText}>{['S', 'M', 'L'][i]}</Text>
                </Pressable>
              ))}
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
  const path = React.useMemo(() => {
    const sk = Skia.Path.MakeFromSVGString(shape.path)
    if (!sk) return null
    const m = Skia.Matrix()
    m.scale(size, size)
    sk.transform(m)
    return sk
  }, [shape.path, size])
  if (!path) return null
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={path} color="#aeb9d0" />
    </Canvas>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#0d1120',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#232b42',
    paddingVertical: 6,
    gap: 6,
  },
  modeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#12162a',
    borderRadius: 8,
    padding: 2,
  },
  modeButton: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 6 },
  modeButtonActive: { backgroundColor: '#2a3554' },
  modeText: { color: '#7f8db0', fontSize: 13 },
  modeTextActive: { color: '#e6ecf7', fontWeight: '600' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  option: {
    minWidth: 40,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1c2233',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  optionActive: { backgroundColor: '#2a3554', borderWidth: 1, borderColor: '#4da3ff' },
  optionText: { color: '#c9d6ea', fontSize: 12 },
  hint: { color: '#ffd166', fontSize: 11, textAlign: 'center', paddingHorizontal: 16 },
  widthDot: { backgroundColor: '#c9d6ea' },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3d4a6e',
  },
})
