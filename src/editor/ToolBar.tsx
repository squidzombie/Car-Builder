import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Canvas, DashPathEffect, FillType, Path, Skia } from '@shopify/react-native-skia'
import { MiniSlider } from './MiniSlider'
import type { Color } from '../model/types'
import type { Shape } from '../model/shapeTypes'
import { ROTATION_ORDER, SYMMETRY_ORDER, type RotationMode, type SymmetryMode } from './tools'
import { Pill, PillDivider, Segmented, type FeatherName } from './controls'
import { color, panel, radius, space, type } from './theme'

// M3 tool bar: mode switch plus per-mode options. Deliberately restrained
// styling — text labels and geometric glyphs, no emoji (user feedback).
// Options for the active mode sit on one contained strip; symmetry and
// stamp rotation are shown as glyph groups, so every state is visible
// rather than hidden behind a cycling button.

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

export const DRAW_WIDTH_MIN = 2
export const DRAW_WIDTH_MAX = 48
export const STAMP_SIZE_MIN = 16
export const STAMP_SIZE_MAX = 320

const MODES: { key: EditorMode; label: string }[] = [
  { key: 'select', label: 'Select' },
  { key: 'draw', label: 'Draw' },
  { key: 'stamp', label: 'Stamp' },
]

const ROTATION_ICON: Record<RotationMode, FeatherName> = {
  fixed: 'arrow-up',
  random: 'shuffle',
  follow: 'navigation',
}
const ROTATION_HINT: Record<RotationMode, string> = {
  fixed: 'Upright',
  random: 'Random rotation',
  follow: 'Follow the drag',
}

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
  /** alignment snapping while dragging (the override when it fights you) */
  snap: boolean
  onSnap: (on: boolean) => void
}

export function ToolBar(p: Props) {
  return (
    <View style={styles.bar}>
      <Segmented<EditorMode> items={MODES} value={p.mode} onChange={p.onMode} compact />

      {p.mode === 'select' ? (
        <Strip>
          <Pill icon="crosshair" label="Snap" active={p.snap} onPress={() => p.onSnap(!p.snap)} />
        </Strip>
      ) : null}

      {p.mode === 'draw' ? (
        <>
          <View style={styles.sizeRow}>
            <MiniSlider
              label={`Width · ${Math.round(p.draw.width)}`}
              value={p.draw.width}
              min={DRAW_WIDTH_MIN}
              max={DRAW_WIDTH_MAX}
              step={1}
              onChange={(v) => p.onDraw({ width: Math.round(v), eraser: false })}
            />
          </View>
          <Strip>
            <Pill onPress={() => p.onOpenColor('draw')} accessibilityLabel="Draw color">
              <ColorDot color={p.draw.color} />
            </Pill>
            <Pill label="Eraser" active={p.draw.eraser} onPress={() => p.onDraw({ eraser: !p.draw.eraser })} />
            <PillDivider />
            {SYMMETRY_ORDER.map((m) => (
              <Pill
                key={m}
                active={p.draw.symmetry === m}
                style={styles.glyphPill}
                onPress={() => p.onDraw({ symmetry: m })}
              >
                <SymmetryGlyph mode={m} active={p.draw.symmetry === m} />
              </Pill>
            ))}
            <PillDivider />
            <Pill icon="plus" label="Layer" onPress={p.onNewLayer} />
          </Strip>
        </>
      ) : null}

      {p.mode === 'draw' && p.draw.eraser && !p.drawTargetSelected ? (
        <Text style={styles.hint}>Select a drawing in the layer list to erase from it</Text>
      ) : null}

      {p.mode === 'stamp' ? (
        <>
          <Strip>
            {p.shapes.map((s) => (
              <Pill
                key={s.id}
                active={p.stamp.shapeId === s.id}
                style={styles.glyphPill}
                onPress={() => p.onStamp({ shapeId: s.id })}
              >
                <ShapeGlyph shape={s} />
              </Pill>
            ))}
            <PillDivider />
            <Pill icon="plus" label="Shape" onPress={p.onOpenBuilder} />
          </Strip>
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
          <Strip>
            <Pill onPress={() => p.onOpenColor('stamp')} accessibilityLabel="Stamp color">
              <ColorDot color={p.stamp.color} />
            </Pill>
            <PillDivider />
            {ROTATION_ORDER.map((m) => (
              <Pill
                key={m}
                icon={ROTATION_ICON[m]}
                active={p.stamp.rotMode === m}
                style={styles.glyphPill}
                onPress={() => p.onStamp({ rotMode: m })}
                accessibilityLabel={ROTATION_HINT[m]}
              />
            ))}
            <Pill label="Jitter" active={p.stamp.jitter} onPress={() => p.onStamp({ jitter: !p.stamp.jitter })} />
            <PillDivider />
            {SYMMETRY_ORDER.map((m) => (
              <Pill
                key={m}
                active={p.stamp.symmetry === m}
                style={styles.glyphPill}
                onPress={() => p.onStamp({ symmetry: m })}
              >
                <SymmetryGlyph mode={m} active={p.stamp.symmetry === m} />
              </Pill>
            ))}
            <PillDivider />
            <Pill icon="plus" label="Layer" onPress={p.onNewLayer} />
          </Strip>
        </>
      ) : null}
    </View>
  )
}

/** One contained option strip; scrolls sideways when the bar is narrow. */
function Strip({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripContent}
    >
      {children}
    </ScrollView>
  )
}

function ColorDot({ color: c }: { color: Color }) {
  return (
    <View style={styles.colorDotBack}>
      <View style={[styles.colorDot, { backgroundColor: c }]} />
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

/**
 * Symmetry mode as a picture: a mark and its mirror(s) across dashed
 * axes — off, left/right, up/down, both.
 */
export function SymmetryGlyph({
  mode,
  size = GLYPH,
  active,
}: {
  mode: SymmetryMode
  size?: number
  active?: boolean
}) {
  const { axes, marks } = React.useMemo(() => {
    const c = size / 2
    const tri = (pts: [number, number][]) => {
      const p = Skia.Path.Make()
      p.moveTo(pts[0][0], pts[0][1])
      for (const [x, y] of pts.slice(1)) p.lineTo(x, y)
      p.close()
      return p
    }
    const axes = Skia.Path.Make()
    const marks = Skia.Path.Make()
    const r = size * 0.2 // mark reach from the axis
    const g = size * 0.09 // gap to the axis
    const h = size * 0.22 // mark half-height
    switch (mode) {
      case 'h':
        axes.moveTo(c, 1)
        axes.lineTo(c, size - 1)
        marks.addPath(tri([[c - g, c - h], [c - g, c + h], [c - g - r, c]]))
        marks.addPath(tri([[c + g, c - h], [c + g, c + h], [c + g + r, c]]))
        break
      case 'v':
        axes.moveTo(1, c)
        axes.lineTo(size - 1, c)
        marks.addPath(tri([[c - h, c - g], [c + h, c - g], [c, c - g - r]]))
        marks.addPath(tri([[c - h, c + g], [c + h, c + g], [c, c + g + r]]))
        break
      case 'both': {
        axes.moveTo(c, 1)
        axes.lineTo(c, size - 1)
        axes.moveTo(1, c)
        axes.lineTo(size - 1, c)
        const q = size * 0.34
        const s = size * 0.12
        marks.addPath(tri([[c - s, c - s], [c - q, c - s], [c - s, c - q]]))
        marks.addPath(tri([[c + s, c - s], [c + q, c - s], [c + s, c - q]]))
        marks.addPath(tri([[c - s, c + s], [c - q, c + s], [c - s, c + q]]))
        marks.addPath(tri([[c + s, c + s], [c + q, c + s], [c + s, c + q]]))
        break
      }
      default:
        marks.addPath(tri([[c - h, c + h], [c + h, c + h], [c, c - h]]))
    }
    return { axes, marks }
  }, [mode, size])
  const ink = active ? color.accent : color.glyph
  return (
    <Canvas style={{ width: size, height: size }}>
      {mode !== 'off' ? (
        <Path path={axes} style="stroke" strokeWidth={1} color={active ? color.accent : color.textDim}>
          <DashPathEffect intervals={[2, 2]} />
        </Path>
      ) : null}
      <Path path={marks} color={ink} />
    </Canvas>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.bgBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  sizeRow: { paddingHorizontal: space.md },
  strip: {
    ...panel,
    borderRadius: radius.lg,
    marginHorizontal: space.md,
    flexGrow: 0,
  },
  stripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: '100%',
  },
  glyphPill: { minWidth: 44, paddingHorizontal: 8 },
  hint: { color: color.warn, fontSize: type.xs, textAlign: 'center', paddingHorizontal: 16 },
  colorDotBack: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.swatchBack,
    overflow: 'hidden',
  },
  colorDot: { flex: 1 },
})
