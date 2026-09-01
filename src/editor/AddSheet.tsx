import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'
import { Canvas, Group } from '@shopify/react-native-skia'
import { BUILTIN_SHAPES } from '../model/shapes'
import { defaultViewState, CARD_W } from '../model/types'
import { registerAsset, setAssetUri } from '../model/assets'
import { persistAsset } from '../model/storage'
import { blankCard } from '../templates/blank'
import { CardRenderer } from '../renderer/CardRenderer'
import {
  BADGE_PRESETS,
  BORDER_PRESETS,
  PLATE_PRESETS,
  type ElementPreset,
} from '../presets/elements'
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
// stable fallback: a selector must not fabricate a fresh array per snapshot
const NO_SHAPES: never[] = []

export function AddSheet({ onClose, onOpenBuilder }: Props) {
  const customShapes = useEditor((s) => s.doc.shapes) ?? NO_SHAPES
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

  const addElement = (preset: ElementPreset) => {
    const built = preset.build()
    const s = useEditor.getState()
    s.apply((doc) => {
      if (built.shapes) {
        doc.shapes = doc.shapes ?? []
        for (const sh of built.shapes) {
          if (!doc.shapes.some((x) => x.id === sh.id)) doc.shapes.push(sh)
        }
      }
      doc[s.side].layers.push(...built.layers)
    })
    s.select(built.layers[built.layers.length - 1].id)
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

      <ScrollView style={styles.sections} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Shapes</Text>
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

        <ElementRow label="Borders" presets={BORDER_PRESETS} onAdd={addElement} />
        <ElementRow label="Name plates" presets={PLATE_PRESETS} onAdd={addElement} />
        <ElementRow label="Badges" presets={BADGE_PRESETS} onAdd={addElement} />
      </ScrollView>
    </Sheet>
  )
}

const EL_W = 76
const EL_H = 106

function ElementRow({
  label,
  presets,
  onAdd,
}: {
  label: string
  presets: ElementPreset[]
  onAdd: (p: ElementPreset) => void
}) {
  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.elementRow}>
          {presets.map((p) => (
            <ElementTile key={p.id} preset={p} onAdd={onAdd} />
          ))}
        </View>
      </ScrollView>
    </>
  )
}

function ElementTile({ preset, onAdd }: { preset: ElementPreset; onAdd: (p: ElementPreset) => void }) {
  const doc = useMemo(() => {
    const built = preset.build()
    const d = blankCard(`el-${preset.id}`)
    d.shapes = built.shapes
    d.front.layers = [
      {
        id: 'el-bg',
        name: 'bg',
        type: 'fill',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        opacity: 1,
        blendMode: 'srcOver',
        locked: false,
        visible: true,
        fill: { paint: { color: '#141a2e' } },
      },
      ...built.layers,
    ]
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id])

  return (
    <Pressable style={styles.elementTile} onPress={() => onAdd(preset)}>
      <View style={styles.elementCard}>
        <Canvas style={{ width: EL_W, height: EL_H }}>
          <Group>
            <CardRenderer
              doc={doc}
              side="front"
              viewState={defaultViewState()}
              scale={EL_W / CARD_W}
            />
          </Group>
        </Canvas>
      </View>
      <Text style={styles.elementLabel} numberOfLines={1}>
        {preset.name}
      </Text>
    </Pressable>
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
  sectionLabel: { color: color.textDim, fontSize: type.sm, marginTop: 10, marginBottom: 8 },
  sections: { maxHeight: 380 },
  shapeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  elementRow: { flexDirection: 'row', gap: 10 },
  elementTile: { alignItems: 'center', gap: 4 },
  elementCard: {
    width: EL_W,
    height: EL_H,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairlineBright,
  },
  elementLabel: { color: color.textDim, fontSize: type.xs, maxWidth: EL_W },
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
