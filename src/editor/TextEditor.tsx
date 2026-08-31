import React from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Layer } from '../model/types'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'

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
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Text · {layer.name}</Text>
          <Pressable style={styles.doneButton} hitSlop={6} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          value={t.content}
          onFocus={() => useEditor.getState().beginGesture()}
          onChangeText={(content) => patch((l) => (l.text!.content = content))}
          autoCapitalize="characters"
          autoCorrect={false}
          multiline={false}
        />

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
  input: {
    color: '#e6ecf7',
    fontSize: 16,
    backgroundColor: '#1c2233',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alignRow: { flexDirection: 'row', gap: 8 },
  alignChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1c2233',
  },
  alignChipActive: { backgroundColor: '#2a3554', borderWidth: 1, borderColor: '#4da3ff' },
  alignText: { color: '#7f8db0', fontSize: 13 },
  alignTextActive: { color: '#e6ecf7' },
})
