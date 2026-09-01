import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Canvas, Group } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import { defaultViewState, type CardDocument } from '../model/types'
import { TEMPLATES } from '../templates'
import { deleteCard, listCardDocs } from '../model/storage'
import { useDocImages } from './useDocImages'
import { Sheet } from '../editor/Sheet'
import { color, type } from '../editor/theme'

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
  const { height } = useWindowDimensions()
  const previews = useMemo(
    () => TEMPLATES.map((t) => ({ template: t, doc: t.make(`preview-${t.id}`) })),
    [],
  )
  const [saved, setSaved] = useState<CardDocument[]>([])
  useEffect(() => {
    listCardDocs().then(setSaved).catch(() => {})
  }, [])

  return (
    <Sheet title="New card" onClose={onClose} closeLabel="Close" backdrop>
      <ScrollView style={{ maxHeight: height * 0.62 }} showsVerticalScrollIndicator={false}>
        {saved.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Your cards · hold to delete</Text>
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
        <Text style={styles.sectionTitle}>Templates</Text>
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
        <Text style={styles.hint}>Your current card is saved automatically</Text>
      </ScrollView>
    </Sheet>
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
  sectionTitle: { color: color.textDim, fontSize: type.sm },
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
    borderColor: color.hairlineBright,
  },
  tileLabel: { color: color.textMid, fontSize: type.md },
  hint: { color: color.textGhost, fontSize: type.xs, textAlign: 'center' },
  shelf: { flexDirection: 'row', gap: 12, paddingVertical: 2 },
})
