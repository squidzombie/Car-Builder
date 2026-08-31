import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Canvas, Group } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import { defaultViewState, type CardDocument } from '../model/types'
import { TEMPLATES } from '../templates'
import { deleteCard, listCardDocs } from '../model/storage'
import { useDocImages } from './useDocImages'

// New-card template chooser (M5, §8) plus the saved-cards shelf (M6):
// live CardRenderer previews for both. Templates start a fresh document;
// saved cards reopen in place. Long-press a saved card to delete it.

const TILE_W = 132
const TILE_H = 185
const MINI_W = 84
const MINI_H = 118

type Props = {
  onPick: (templateId: string) => void
  onOpenSaved: (doc: CardDocument) => void
  onClose: () => void
}

export function TemplateChooser({ onPick, onOpenSaved, onClose }: Props) {
  const previews = useMemo(
    () => TEMPLATES.map((t) => ({ template: t, doc: t.make(`preview-${t.id}`) })),
    [],
  )
  const [saved, setSaved] = useState<CardDocument[]>([])
  useEffect(() => {
    listCardDocs().then(setSaved).catch(() => {})
  }, [])

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {saved.length > 0 ? (
          <>
            <Text style={styles.title}>Your cards · hold to delete</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.shelf}>
                {saved.map((doc) => (
                  <SavedTile
                    key={doc.id}
                    doc={doc}
                    onOpen={() => onOpenSaved(doc)}
                    onDelete={() => {
                      deleteCard(doc.id).catch(() => {})
                      setSaved((s) => s.filter((d) => d.id !== doc.id))
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          </>
        ) : null}
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

function SavedTile({
  doc,
  onOpen,
  onDelete,
}: {
  doc: CardDocument
  onOpen: () => void
  onDelete: () => void
}) {
  const assets = useDocImages(doc)
  return (
    <Pressable style={styles.tile} onPress={onOpen} onLongPress={onDelete}>
      <View style={[styles.tileCard, { width: MINI_W, height: MINI_H }]}>
        <Canvas style={{ width: MINI_W, height: MINI_H }}>
          <Group>
            <CardRenderer
              doc={doc}
              side="front"
              viewState={defaultViewState()}
              assets={assets}
              scale={MINI_W / doc.size.w}
            />
          </Group>
        </Canvas>
      </View>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {doc.meta.title ?? doc.meta.templateId ?? 'Card'}
      </Text>
    </Pressable>
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
  shelf: { flexDirection: 'row', gap: 12, paddingVertical: 2 },
})
