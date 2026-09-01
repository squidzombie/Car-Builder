import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { buildPolygonPath } from '../model/shapes'
import type { Shape } from '../model/shapeTypes'
import { useEditor } from '../state/useEditor'
import { newLayerId } from '../state/editorStore'
import { ShapeGlyph } from './ToolBar'
import { MiniSlider } from './MiniSlider'
import { Sheet } from './Sheet'
import { color, radius, type } from './theme'

// Custom polygon builder (CLAUDE.md §4): sides 3–24, optional star inset,
// optional corner rounding. Saved shapes live in CardDocument.shapes so
// they travel with the card, and work everywhere a built-in does.

type Props = {
  onClose: () => void
  onSaved: (shapeId: string) => void
}

export function ShapeBuilder({ onClose, onSaved }: Props) {
  const [sides, setSides] = useState(5)
  const [star, setStar] = useState(true)
  const [inset, setInset] = useState(0.5)
  const [rounding, setRounding] = useState(0)

  const path = useMemo(
    () =>
      buildPolygonPath({
        sides,
        insetRatio: star ? inset : undefined,
        cornerRadius: rounding,
      }),
    [sides, star, inset, rounding],
  )

  const preview: Shape = useMemo(
    () => ({ id: 'preview', name: 'preview', path, builtIn: false }),
    [path],
  )

  const save = () => {
    const id = newLayerId('shape-custom')
    const name = star ? `${sides}-point star` : `${sides}-gon`
    const shape: Shape = { id, name, path, builtIn: false }
    useEditor.getState().apply((doc) => {
      doc.shapes = [...(doc.shapes ?? []), shape]
    })
    onSaved(id)
  }

  return (
    <Sheet
      title="Custom shape"
      onClose={onClose}
      closeLabel="Cancel"
      backdrop
      headerRight={
        <Pressable style={styles.saveButton} hitSlop={8} onPress={save}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      }
    >
      <View style={styles.previewRow}>
          <View style={styles.previewBox}>
            <ShapeGlyph shape={preview} size={96} />
          </View>
        </View>

        <MiniSlider
          label={`Sides · ${sides}`}
          value={sides}
          min={3}
          max={24}
          step={1}
          onChange={(v) => setSides(Math.round(v))}
        />
        <View style={styles.switchRow}>
          <Text style={styles.sliderLabel}>Star</Text>
          <Switch value={star} onValueChange={setStar} />
        </View>
        {star ? (
          <MiniSlider
            label={`Inset · ${inset.toFixed(2)}`}
            value={inset}
            min={0.2}
            max={0.9}
            onChange={setInset}
          />
        ) : null}
        <MiniSlider
          label={`Rounding · ${rounding.toFixed(2)}`}
          value={rounding}
          min={0}
          max={0.4}
          onChange={setRounding}
        />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  saveButton: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#0b0e19', fontSize: type.base, fontWeight: '700' },
  previewRow: { alignItems: 'center' },
  previewBox: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: color.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  sliderLabel: { color: color.textDim, fontSize: type.sm },
})
