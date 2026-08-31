import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { FinishFamily, Layer } from '../model/types'
import { FINISH_PRESETS, makeFinish } from '../finishes/presets'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'

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
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Finish · {layer.name}</Text>
          <Pressable style={styles.doneButton} hitSlop={6} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, !finish && styles.chipActive]}
              onPress={() => patch((l) => (l.finish = undefined))}
            >
              <Text style={[styles.chipText, !finish && styles.chipTextActive]}>None</Text>
            </Pressable>
            {FAMILIES.map((f) => {
              const active = family === f.key
              return (
                <Pressable
                  key={f.key}
                  style={[styles.chip, active && finish?.family === f.key && styles.chipActive]}
                  onPress={() => setFamily(f.key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && finish?.family === f.key && styles.chipTextActive,
                      active && styles.chipTextFocus,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {FINISH_PRESETS.filter((p) => p.family === family).map((p) => {
              const active = finish?.family === p.family && finish?.preset === p.preset
              return (
                <Pressable
                  key={p.preset}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => pickPreset(p.family, p.preset)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

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
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#10141f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingBottom: 34,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a3554',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#e6ecf7', fontSize: 15, fontWeight: '600' },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#2a3554',
  },
  doneText: { color: '#e6ecf7', fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1c2233',
  },
  chipActive: { backgroundColor: '#2a3554', borderWidth: 1, borderColor: '#4da3ff' },
  chipText: { color: '#7f8db0', fontSize: 13 },
  chipTextActive: { color: '#e6ecf7' },
  chipTextFocus: { color: '#c9d6ea' },
  paletteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paletteLabel: { color: '#7f8db0', fontSize: 12, marginRight: 4 },
  hint: { color: '#3d4560', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
})
