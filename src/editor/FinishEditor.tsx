import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Canvas, Rect, Shader } from '@shopify/react-native-skia'
import { lightFromTilt, type FinishFamily, type Layer, type ViewState } from '../model/types'
import { FINISH_PRESETS, makeFinish, type FinishPreset } from '../finishes/presets'
import { getFinishEffect } from '../finishes'
import { buildFinishUniforms } from '../finishes/uniforms'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'
import { chip, chipActive, chipText, chipTextActive, color, pressed, radius, raised, type } from './theme'
import { pressHaptic } from '../view/haptics'

// Finish + Surface sections of the Appearance sheet (M4, CLAUDE.md §5):
// per-layer family + preset, intensity and pattern scale, palette mode
// ('custom' feeds the card's pinned swatches into the holo shader, §6),
// and the emboss surface. The editor canvas sweeps its tilt while these
// are open, so the finish shimmers live as you tune it.

const FAMILIES: { key: FinishFamily; label: string }[] = [
  { key: 'spectrum', label: 'Spectrum' },
  { key: 'geometric', label: 'Geometric' },
  { key: 'fluid', label: 'Fluid' },
  { key: 'metallic', label: 'Metallic' },
  { key: 'sparkle', label: 'Sparkle' },
]

const usePatch = (layerId: string) => (fn: (l: Layer) => void, transient = false) =>
  useEditor.getState().updateLayer(layerId, fn, { transient })

export function FinishSection({ layerId }: { layerId: string }) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  const [family, setFamily] = useState<FinishFamily>(layer?.finish?.family ?? 'spectrum')
  const patch = usePatch(layerId)
  if (!layer) return null
  const finish = layer.finish

  const pickPreset = (fam: FinishFamily, preset: string) => {
    patch((l) => {
      l.finish = makeFinish(fam, preset, {
        intensity: l.finish?.intensity ?? 0.85,
        paletteMode: l.finish?.paletteMode ?? 'rainbow',
      })
    })
  }

  return (
    <>
      {/* One surface for the whole picker: the family strip and its
          presets live inside the same panel, so the selection and its
          options are genuinely connected — no seam at any scroll
          position. The open family is a filled pill on that surface. */}
      <View style={styles.panel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.famRow}>
            <Pressable
              {...pressHaptic}
              style={pressed(styles.famChip, !finish && styles.famChipActive)}
              onPress={() => patch((l) => (l.finish = undefined))}
            >
              <Text style={[styles.famText, !finish && styles.famTextActive]}>None</Text>
            </Pressable>
            {FAMILIES.map((f) => {
              const open = family === f.key
              return (
                <Pressable
                  {...pressHaptic}
                  key={f.key}
                  style={pressed(styles.famChip, open && styles.famChipActive)}
                  onPress={() => setFamily(f.key)}
                >
                  <Text style={[styles.famText, open && styles.famTextActive]}>{f.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tileRow}>
            {FINISH_PRESETS.filter((p) => p.family === family).map((p) => {
              const active = finish?.family === p.family && finish?.preset === p.preset
              return (
                <Pressable
                  {...pressHaptic}
                  key={p.preset}
                  style={pressed(styles.tile)}
                  onPress={() => pickPreset(p.family, p.preset)}
                >
                  <View style={[styles.swatchWrap, active && styles.swatchWrapActive]}>
                    <FinishSwatch preset={p} />
                  </View>
                  <Text
                    style={[styles.tileLabel, active && styles.tileLabelActive]}
                    numberOfLines={1}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </View>

      {finish ? (
        <>
          <MiniSlider
            label={`Intensity · ${finish.intensity.toFixed(2)}`}
            value={finish.intensity}
            min={0.1}
            max={1}
            onBegin={() => useEditor.getState().beginGesture()}
            onChange={(v) => patch((l) => void (l.finish && (l.finish.intensity = v)), true)}
          />
          <MiniSlider
            label={`Pattern scale · ${finish.scale.toFixed(2)}`}
            value={finish.scale}
            min={0.4}
            max={2.5}
            onBegin={() => useEditor.getState().beginGesture()}
            onChange={(v) => patch((l) => void (l.finish && (l.finish.scale = v)), true)}
          />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Colors</Text>
            {(
              [
                ['rainbow', 'Rainbow'],
                ['custom', 'Card palette'],
              ] as const
            ).map(([mode, label]) => (
              <Pressable
                {...pressHaptic}
                key={mode}
                style={pressed(styles.chip, finish.paletteMode === mode && styles.chipActive)}
                onPress={() =>
                  patch((l) => {
                    if (l.finish) {
                      l.finish.paletteMode = mode
                      l.finish.customColors = undefined
                    }
                  })
                }
              >
                <Text style={[styles.chipText, finish.paletteMode === mode && styles.chipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.hint}>Pick a pattern to give this layer a holo finish</Text>
      )}
    </>
  )
}

export function SurfaceSection({ layerId }: { layerId: string }) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  const patch = usePatch(layerId)
  if (!layer) return null
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Surface</Text>
        {(
          [
            ['flat', 'Flat'],
            ['raised', 'Raised'],
            ['inset', 'Inset'],
          ] as const
        ).map(([key, label]) => {
          const active = key === 'flat' ? !layer.emboss : layer.emboss?.style === key
          return (
            <Pressable
              {...pressHaptic}
              key={key}
              style={pressed(styles.chip, active && styles.chipActive)}
              onPress={() =>
                patch((l) => {
                  l.emboss =
                    key === 'flat' ? undefined : { height: l.emboss?.height ?? 0.5, style: key }
                })
              }
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      {layer.emboss ? (
        <MiniSlider
          label={`Depth · ${layer.emboss.height.toFixed(2)}`}
          value={layer.emboss.height}
          min={0.1}
          max={1}
          onBegin={() => useEditor.getState().beginGesture()}
          onChange={(v) => patch((l) => void (l.emboss && (l.emboss.height = v)), true)}
        />
      ) : (
        <Text style={styles.hint}>Raised ink catches the light as the card tilts</Text>
      )}
    </>
  )
}

const SWATCH = 54
const SWATCH_VIEW: ViewState = { tiltX: 0.4, tiltY: -0.25, ...lightFromTilt(0.4, -0.25) }

/** Live 54px render of a finish preset (the real shader at a fixed tilt). */
function FinishSwatch({ preset }: { preset: FinishPreset }) {
  const uniforms = useMemo(
    () =>
      buildFinishUniforms(makeFinish(preset.family, preset.preset), SWATCH_VIEW, {
        w: SWATCH,
        h: SWATCH,
      }),
    [preset],
  )
  return (
    <Canvas style={{ width: SWATCH, height: SWATCH, backgroundColor: color.bg0 }}>
      <Rect x={0} y={0} width={SWATCH} height={SWATCH}>
        <Shader source={getFinishEffect(preset.family)} uniforms={uniforms} />
      </Rect>
    </Canvas>
  )
}

const PANEL = color.bg2

const styles = StyleSheet.create({
  chip,
  chipActive,
  chipText,
  chipTextActive,
  panel: {
    backgroundColor: PANEL,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  famRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  famChip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  famChipActive: { backgroundColor: color.chipActive, ...raised },
  famText: { color: color.textDim, fontSize: type.md },
  famTextActive: { color: color.accent, fontWeight: '600' },
  tileRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  tile: { alignItems: 'center', gap: 4, width: SWATCH + 10 },
  swatchWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchWrapActive: { borderColor: color.accent },
  tileLabel: { color: color.textDim, fontSize: type.xs },
  tileLabelActive: { color: color.text, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { color: color.textDim, fontSize: type.sm, marginRight: 4 },
  hint: { color: color.textGhost, fontSize: type.sm, textAlign: 'center', paddingVertical: 8 },
})
