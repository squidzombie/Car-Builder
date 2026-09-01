import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Layer } from '../model/types'
import { FONT_CHOICES } from '../renderer/fonts'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'
import { Sheet } from './Sheet'
import { chip, chipActive, chipText, chipTextActive, color, type } from './theme'

// Text layer editor (M3, §4 basics): content, size, alignment. Edits are
// transient inside one gesture group per control interaction; the card
// stays visible above the sheet for live preview.

type Props = { layerId: string; onClose: () => void }

export function TextEditor({ layerId, onClose }: Props) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  if (!layer?.text) return null
  const t = layer.text

  const patch = (fn: (l: Layer) => void, transient = true) => {
    useEditor.getState().updateLayer(layerId, fn, { transient })
  }

  return (
    <Sheet title={`Text · ${layer.name}`} onClose={onClose}>
      <TextInput
          style={styles.input}
          value={t.content}
          onFocus={() => useEditor.getState().beginGesture()}
          onChangeText={(content) => patch((l) => (l.text!.content = content))}
          autoCapitalize="characters"
          autoCorrect={false}
          multiline={false}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.alignRow}>
            {FONT_CHOICES.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.alignChip, t.font === f.key && styles.alignChipActive]}
                onPress={() => patch((l) => (l.text!.font = f.key), false)}
              >
                <Text style={[styles.alignText, t.font === f.key && styles.alignTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <MiniSlider
          label={`Size · ${Math.round(t.size)}`}
          value={t.size}
          min={20}
          max={180}
          step={2}
          onBegin={() => useEditor.getState().beginGesture()}
          onChange={(v) => patch((l) => (l.text!.size = v))}
        />

        <View style={styles.alignRow}>
          {(
            [
              ['l', 'Left'],
              ['c', 'Center'],
              ['r', 'Right'],
            ] as const
          ).map(([a, label]) => (
            <Pressable
              key={a}
              style={[styles.alignChip, t.align === a && styles.alignChipActive]}
              onPress={() => patch((l) => (l.text!.align = a), false)}
            >
              <Text style={[styles.alignText, t.align === a && styles.alignTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  input: {
    color: color.text,
    fontSize: 16,
    backgroundColor: color.chip,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alignRow: { flexDirection: 'row', gap: 8 },
  alignChip: chip,
  alignChipActive: chipActive,
  alignText: chipText,
  alignTextActive: chipTextActive,
})
