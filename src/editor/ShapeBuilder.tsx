import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { buildPolygonPath } from '../model/shapes'
import type { Shape } from '../model/shapeTypes'
import { useEditor } from '../state/useEditor'
import { newLayerId } from '../state/editorStore'
import { ShapeGlyph } from './ToolBar'
import { MiniSlider } from './MiniSlider'

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
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Custom shape</Text>
          <Pressable style={styles.saveButton} hitSlop={6} onPress={save}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>

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
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#00000066',
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#2a3554',
  },
  saveText: { color: '#e6ecf7', fontSize: 14, fontWeight: '600' },
  previewRow: { alignItems: 'center' },
  previewBox: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#1c2233',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  sliderLabel: { color: '#7f8db0', fontSize: 12 },
})
