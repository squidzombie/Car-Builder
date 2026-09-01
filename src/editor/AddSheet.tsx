import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'
import { BUILTIN_SHAPES } from '../model/shapes'
import { registerAsset, setAssetUri } from '../model/assets'
import { persistAsset } from '../model/storage'
import { useEditor } from '../state/useEditor'
import {
  makeFillLayer,
  makeImageLayer,
  makeShapeLayer,
  makeTextLayer,
} from '../state/editorStore'
import { Sheet } from './Sheet'
import { ShapeGlyph } from './ToolBar'
import { color, radius, type } from './theme'

// The sectioned Add sheet (Build 3): everything addable in one place —
// media, text, fills, the full shape library, custom shapes. Build 5's
// preset libraries (borders, plates, badges) plug in as more sections.

type Props = {
  onClose: () => void
  onOpenBuilder: () => void
}

const DEFAULT_SHAPE_COLOR = '#c9d6ea'

export function AddSheet({ onClose, onOpenBuilder }: Props) {
  const customShapes = useEditor((s) => s.doc.shapes ?? [])
  const addLayer = useEditor((s) => s.addLayer)

  const pickPhoto = async () => {
    onClose()
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    const asset = res.assets?.[0]
    if (res.canceled || !asset) return
    const assetId = registerAsset(asset.uri)
    persistAsset(asset.uri, assetId)
      .then((uri) => setAssetUri(assetId, uri))
      .catch(() => {})
    addLayer(makeImageLayer(assetId, asset.width ?? 1000, asset.height ?? 1000))
  }

  const add = (make: () => ReturnType<typeof makeTextLayer>) => {
    addLayer(make())
    onClose()
  }

  return (
    <Sheet title="Add to card" onClose={onClose} closeLabel="Cancel" backdrop>
      <View style={styles.tileRow}>
        <BigTile icon="image" label="Photo" onPress={pickPhoto} />
        <BigTile icon="type" label="Text" onPress={() => add(makeTextLayer)} />
        <BigTile
          icon="square"
          label="Fill"
          onPress={() => add(() => makeFillLayer({ color: '#12355b' }))}
        />
        <BigTile
          icon="sunset"
          label="Gradient"
          onPress={() =>
            add(() =>
              makeFillLayer({
                gradient: {
                  type: 'linear',
                  angle: 115,
                  stops: [
                    { offset: 0, color: '#0b1b3a' },
                    { offset: 1, color: '#4da3ff' },
                  ],
                },
              }),
            )
          }
        />
      </View>

      <Text style={styles.sectionLabel}>Shapes</Text>
      <ScrollView style={styles.shapeScroll}>
        <View style={styles.shapeGrid}>
          {[...BUILTIN_SHAPES, ...customShapes].map((s) => (
            <Pressable
              key={s.id}
              style={styles.shapeTile}
              onPress={() => add(() => makeShapeLayer(s.id, { color: DEFAULT_SHAPE_COLOR }))}
            >
              <ShapeGlyph shape={s} size={26} />
            </Pressable>
          ))}
          <Pressable style={[styles.shapeTile, styles.customTile]} onPress={onOpenBuilder}>
            <Feather name="plus" size={20} color={color.textDim} />
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
  )
}

function BigTile({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name']
  label: string
  onPress: () => void
}) {
  return (
    <Pressable style={styles.bigTile} onPress={onPress}>
      <Feather name={icon} size={22} color={color.textMid} />
      <Text style={styles.bigTileLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tileRow: { flexDirection: 'row', gap: 10 },
  bigTile: {
    flex: 1,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: color.bg2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairlineBright,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bigTileLabel: { color: color.textMid, fontSize: type.sm },
  sectionLabel: { color: color.textDim, fontSize: type.sm },
  shapeScroll: { maxHeight: 176 },
  shapeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shapeTile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTile: {
    borderWidth: 1,
    borderColor: color.hairlineBright,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
})
