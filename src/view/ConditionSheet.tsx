import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ConditionPreset } from '../model/types'
import { useEditor } from '../state/useEditor'
import { Sheet } from '../editor/Sheet'
import { MiniSlider } from '../editor/MiniSlider'
import { chip, chipActive, chipText, chipTextActive } from '../editor/theme'

// Card condition / grade (Build 4): a card-level, tilt-reactive wear
// overlay — scratches that glint, whitened edges, scuffed corners. The
// card stays visible above the sheet, so changes preview live.

const PRESETS: [ConditionPreset | null, string][] = [
  [null, 'Pristine'],
  ['mint', 'Mint'],
  ['near-mint', 'Near mint'],
  ['played', 'Played'],
  ['heavily-played', 'Heavy'],
]

export function ConditionSheet({ onClose }: { onClose: () => void }) {
  const condition = useEditor((s) => s.doc.condition)

  const setPreset = (preset: ConditionPreset | null) => {
    useEditor.getState().apply((doc) => {
      doc.condition = preset
        ? { preset, intensity: doc.condition?.intensity ?? 0.8 }
        : undefined
    })
  }

  return (
    <Sheet title="Condition" onClose={onClose}>
      <View style={styles.row}>
        {PRESETS.map(([preset, label]) => {
          const active = preset === null ? !condition : condition?.preset === preset
          return (
            <Pressable
              key={label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setPreset(preset)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      {condition ? (
        <MiniSlider
          label={`Wear · ${condition.intensity.toFixed(2)}`}
          value={condition.intensity}
          min={0.1}
          max={1}
          onBegin={() => useEditor.getState().beginGesture()}
          onChange={(v) =>
            useEditor
              .getState()
              .applyTransient((doc) => void (doc.condition && (doc.condition.intensity = v)))
          }
        />
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip,
  chipActive,
  chipText,
  chipTextActive,
})
