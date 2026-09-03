import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Color, Layer } from '../model/types'
import { FONT_CHOICES } from '../renderer/fonts'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'
import { Sheet } from './Sheet'
import { chip, chipActive, chipText, chipTextActive, color, pressed, type } from './theme'
import { pressHaptic } from '../view/haptics'

// Text layer editor (M3, §4 basics): content, font, size, alignment — plus
// outline and shadow, the two things that make a name read over a photo
// the way real card typography does. Edits are transient inside one
// gesture group per control interaction; the card stays visible above
// the sheet for live preview.

type Props = { layerId: string; onClose: () => void }

type TextShadow = NonNullable<NonNullable<Layer['text']>['shadow']>

const SHADOWS: { key: string; label: string; value: TextShadow }[] = [
  { key: 'soft', label: 'Soft', value: { color: '#000000a0', dx: 0, dy: 5, blur: 9 } },
  { key: 'hard', label: 'Hard', value: { color: '#000000', dx: 5, dy: 5, blur: 0 } },
  { key: 'glow', label: 'Glow', value: { color: '#ffffffb0', dx: 0, dy: 0, blur: 12 } },
]

export function TextEditor({ layerId, onClose }: Props) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  const pinned = useEditor((s) => s.doc.palette.pinned)
  if (!layer?.text) return null
  const t = layer.text

  const patch = (fn: (l: Layer) => void, transient = true) => {
    useEditor.getState().updateLayer(layerId, fn, { transient })
  }

  const outlineColors: Color[] = ['#000000', '#ffffff', ...pinned.slice(0, 5)]
  const shadowKey = t.shadow
    ? SHADOWS.find((s) => JSON.stringify(s.value) === JSON.stringify(t.shadow))?.key ?? 'custom'
    : 'none'

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
        <View style={styles.row}>
          {FONT_CHOICES.map((f) => (
            <Pressable
              {...pressHaptic}
              key={f.key}
              style={pressed(styles.chip, t.font === f.key && styles.chipActive)}
              onPress={() => patch((l) => (l.text!.font = f.key), false)}
            >
              <Text style={[styles.chipText, t.font === f.key && styles.chipTextActive]}>
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

      <View style={styles.row}>
        {(
          [
            ['l', 'Left'],
            ['c', 'Center'],
            ['r', 'Right'],
          ] as const
        ).map(([a, label]) => (
          <Pressable
            {...pressHaptic}
            key={a}
            style={pressed(styles.chip, t.align === a && styles.chipActive)}
            onPress={() => patch((l) => (l.text!.align = a), false)}
          >
            <Text style={[styles.chipText, t.align === a && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* outline: none, or a color from black/white/the card's pins */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Outline</Text>
        <Pressable
          {...pressHaptic}
          style={pressed(styles.chip, !t.outline && styles.chipActive)}
          onPress={() => patch((l) => (l.text!.outline = undefined), false)}
        >
          <Text style={[styles.chipText, !t.outline && styles.chipTextActive]}>None</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {outlineColors.map((c) => {
              const active = t.outline?.color === c
              return (
                <Pressable
                  {...pressHaptic}
                  key={c}
                  style={pressed(styles.swatch, active && styles.swatchActive)}
                  onPress={() =>
                    patch(
                      (l) => (l.text!.outline = { color: c, width: l.text!.outline?.width ?? 6 }),
                      false,
                    )
                  }
                >
                  <View style={[styles.swatchFill, { backgroundColor: c }]} />
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </View>
      {t.outline ? (
        <MiniSlider
          label={`Outline width · ${Math.round(t.outline.width)}`}
          value={t.outline.width}
          min={1}
          max={18}
          step={1}
          onBegin={() => useEditor.getState().beginGesture()}
          onChange={(v) => patch((l) => void (l.text!.outline && (l.text!.outline.width = v)))}
        />
      ) : null}

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Shadow</Text>
        <Pressable
          {...pressHaptic}
          style={pressed(styles.chip, shadowKey === 'none' && styles.chipActive)}
          onPress={() => patch((l) => (l.text!.shadow = undefined), false)}
        >
          <Text style={[styles.chipText, shadowKey === 'none' && styles.chipTextActive]}>None</Text>
        </Pressable>
        {SHADOWS.map((s) => (
          <Pressable
            {...pressHaptic}
            key={s.key}
            style={pressed(styles.chip, shadowKey === s.key && styles.chipActive)}
            onPress={() => patch((l) => (l.text!.shadow = { ...s.value }), false)}
          >
            <Text style={[styles.chipText, shadowKey === s.key && styles.chipTextActive]}>
              {s.label}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { color: color.textDim, fontSize: type.sm, marginRight: 4, minWidth: 52 },
  chip,
  chipActive,
  chipText,
  chipTextActive,
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: color.swatchBack,
  },
  swatchActive: { borderColor: color.accent },
  swatchFill: { flex: 1 },
})
