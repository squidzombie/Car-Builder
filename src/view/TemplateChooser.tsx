import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Canvas, Group } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import { defaultViewState } from '../model/types'
import { TEMPLATES } from '../templates'

// New-card template chooser (M5, §8): a 2x2 grid of live CardRenderer
// previews. Picking one replaces the working document.

const TILE_W = 132
const TILE_H = 185

type Props = {
  onPick: (templateId: string) => void
  onClose: () => void
}

export function TemplateChooser({ onPick, onClose }: Props) {
  const previews = useMemo(
    () => TEMPLATES.map((t) => ({ template: t, doc: t.make(`preview-${t.id}`) })),
    [],
  )

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>New card</Text>
        <View style={styles.grid}>
          {previews.map(({ template, doc }) => (
            <Pressable
              key={template.id}
              style={styles.tile}
              onPress={() => onPick(template.id)}
            >
              <View style={styles.tileCard}>
                <Canvas style={{ width: TILE_W, height: TILE_H }}>
                  <Group>
                    <CardRenderer
                      doc={doc}
                      side="front"
                      viewState={defaultViewState()}
                      scale={TILE_W / doc.size.w}
                    />
                  </Group>
                </Canvas>
              </View>
              <Text style={styles.tileLabel}>{template.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Starting a new card replaces the current one</Text>
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
    backgroundColor: '#000000aa',
  },
  sheet: {
    backgroundColor: '#10141f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a3554',
  },
  title: { color: '#e6ecf7', fontSize: 16, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    rowGap: 16,
  },
  tile: { alignItems: 'center', gap: 6 },
  tileCard: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a3554',
  },
  tileLabel: { color: '#c9d6ea', fontSize: 13 },
  hint: { color: '#3d4560', fontSize: 11, textAlign: 'center' },
})
