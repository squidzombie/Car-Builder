import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { FinishFamily, Layer } from '../model/types'
import { FINISH_PRESETS, makeFinish } from '../finishes/presets'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'
import { Sheet } from './Sheet'
import { chip, chipActive, chipText, chipTextActive, color, pressed, radius, type } from './theme'

// Finish picker (M4, CLAUDE.md §5): per-layer family + preset, intensity
// and pattern scale, and the palette mode — 'custom' feeds the card's
// pinned swatches into the holo shader (§6), so any finish recolors to
// match the card. The editor canvas sweeps its tilt while this sheet is
// open, so the finish shimmers live as you tune it.

const FAMILIES: { key: FinishFamily; label: string }[] = [
  { key: 'spectrum', label: 'Spectrum' },
  { key: 'geometric', label: 'Geometric' },
  { key: 'fluid', label: 'Fluid' },
  { key: 'metallic', label: 'Metallic' },
  { key: 'sparkle', label: 'Sparkle' },
]

type Props = { layerId: string; onClose: () => void }

export function FinishEditor({ layerId, onClose }: Props) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  const [family, setFamily] = useState<FinishFamily>(layer?.finish?.family ?? 'spectrum')
  if (!layer) return null
  const finish = layer.finish

  const patch = (fn: (l: Layer) => void, transient = false) => {
    useEditor.getState().updateLayer(layerId, fn, { transient })
  }

  const pickPreset = (fam: FinishFamily, preset: string) => {
    patch((l) => {
      l.finish = makeFinish(fam, preset, {
        intensity: l.finish?.intensity ?? 0.85,
        paletteMode: l.finish?.paletteMode ?? 'rainbow',
      })
    })
  }

  return (
    <Sheet title={`Finish · ${layer.name}`} onClose={onClose}>
      {/* level 1: finish family. A family being browsed is "open"
          (filled); the family actually applied also gets the accent
          ring — so the two states read differently at a glance. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <Pressable
              style={pressed(styles.chip, !finish && styles.chipActive)}
              onPress={() => patch((l) => (l.finish = undefined))}
            >
              <Text style={[styles.chipText, !finish && styles.chipTextActive]}>None</Text>
            </Pressable>
            {FAMILIES.map((f) => {
              const open = family === f.key
              const applied = finish?.family === f.key
              return (
                <Pressable
                  key={f.key}
                  style={pressed(styles.chip, open && styles.chipOpen, applied && styles.chipActive)}
                  onPress={() => setFamily(f.key)}
                >
                  <Text style={[styles.chipText, (open || applied) && styles.chipTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        {/* level 2: the open family's presets, nested in a recessed
            panel with a header naming where you are */}
        <View style={styles.presetPanel}>
          <Text style={styles.presetHeader}>
            {FAMILIES.find((f) => f.key === family)?.label ?? ''} · pick a pattern
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.presetRow}>
              {FINISH_PRESETS.filter((p) => p.family === family).map((p) => {
                const active = finish?.family === p.family && finish?.preset === p.preset
                return (
                  <Pressable
                    key={p.preset}
                    style={pressed(styles.chip, active && styles.chipActive)}
                    onPress={() => pickPreset(p.family, p.preset)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
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
            <View style={styles.paletteRow}>
              <Text style={styles.paletteLabel}>Colors</Text>
              {(
                [
                  ['rainbow', 'Rainbow'],
                  ['custom', 'Card palette'],
                ] as const
              ).map(([mode, label]) => (
                <Pressable
                  key={mode}
                  style={[styles.chip, finish.paletteMode === mode && styles.chipActive]}
                  onPress={() =>
                    patch((l) => {
                      if (l.finish) {
                        l.finish.paletteMode = mode
                        l.finish.customColors = undefined
                      }
                    })
                  }
                >
                  <Text
                    style={[styles.chipText, finish.paletteMode === mode && styles.chipTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.hint}>Pick a preset to give this layer a holo finish</Text>
        )}

        <View style={styles.paletteRow}>
          <Text style={styles.paletteLabel}>Surface</Text>
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
                key={key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() =>
                  patch((l) => {
                    l.emboss =
                      key === 'flat'
                        ? undefined
                        : { height: l.emboss?.height ?? 0.5, style: key }
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
        ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 8 },
  chip,
  chipActive,
  chipText,
  chipTextActive,
  chipOpen: { backgroundColor: color.chipActive },
  presetPanel: {
    backgroundColor: color.track,
    borderRadius: radius.lg,
    paddingVertical: 10,
    gap: 8,
  },
  presetHeader: {
    color: color.textDim,
    fontSize: type.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
  },
  presetRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  paletteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paletteLabel: { color: color.textDim, fontSize: type.sm, marginRight: 4 },
  hint: { color: color.textGhost, fontSize: type.sm, textAlign: 'center', paddingVertical: 8 },
})
