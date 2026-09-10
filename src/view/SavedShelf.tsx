import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Canvas, Group } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import { defaultViewState, type CardDocument } from '../model/types'
import { deleteCard, listCardDocs, saveCard } from '../model/storage'
import { useDocImages } from './useDocImages'
import { Panel, Pill, PillRow } from '../editor/controls'
import { color, pressed, radius, type } from '../editor/theme'
import { pressHaptic, tick } from './haptics'

// The user's saved cards as a shelf (home screen + the New-card chooser):
// tap opens, hold reveals Open / Rename / Duplicate / Delete on one panel.
// Thumbnails render through the real CardRenderer at rest.

export const cardTitle = (d: CardDocument) => d.meta.title ?? d.meta.templateId ?? 'Card'

/** A card's front at rest, on the standard thumbnail ring. */
export function CardThumb({
  doc,
  width,
  active,
}: {
  doc: CardDocument
  width: number
  active?: boolean
}) {
  const assets = useDocImages(doc)
  const height = Math.round((width * doc.size.h) / doc.size.w)
  return (
    <View style={[styles.ring, active && styles.ringActive]}>
      <Canvas style={{ width, height }}>
        <Group>
          <CardRenderer
            doc={doc}
            side="front"
            viewState={defaultViewState()}
            assets={assets}
            scale={width / doc.size.w}
          />
        </Group>
      </Canvas>
    </View>
  )
}

export function useSavedCards() {
  const [saved, setSaved] = useState<CardDocument[]>([])
  const refresh = useCallback(() => {
    listCardDocs().then(setSaved).catch(() => {})
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const rename = (d: CardDocument, title: string) => {
    const updated: CardDocument = { ...d, meta: { ...d.meta, title } }
    saveCard(updated).catch(() => {})
    setSaved((s) => s.map((x) => (x.id === updated.id ? updated : x)))
    return updated
  }
  const duplicate = (d: CardDocument) => {
    const now = new Date().toISOString()
    const copy: CardDocument = {
      ...d,
      id: `card-${Date.now().toString(36)}`,
      meta: { ...d.meta, title: `${cardTitle(d)} copy`, createdAt: now, updatedAt: now },
    }
    saveCard(copy).catch(() => {})
    setSaved((s) => [copy, ...s])
    return copy
  }
  const remove = (d: CardDocument) => {
    deleteCard(d.id).catch(() => {})
    setSaved((s) => s.filter((x) => x.id !== d.id))
  }
  return { saved, refresh, rename, duplicate, remove }
}

export function SavedShelf({
  title,
  onOpen,
  tileWidth = 84,
  inset = 0,
}: {
  /** section heading; rendered only when there is something to show */
  title?: string
  onOpen: (doc: CardDocument) => void
  tileWidth?: number
  /** horizontal inset for the heading and the shelf's first tile (full-bleed scroll) */
  inset?: number
}) {
  const { saved, rename, duplicate, remove } = useSavedCards()
  const [managing, setManaging] = useState<CardDocument | null>(null)
  const [renameDraft, setRenameDraft] = useState<string | null>(null)
  if (saved.length === 0) return null

  const commitRename = () => {
    if (!managing || renameDraft === null) return
    const trimmed = renameDraft.trim()
    if (trimmed) setManaging(rename(managing, trimmed))
    setRenameDraft(null)
  }
  const confirmDelete = (d: CardDocument) => {
    Alert.alert(`Delete "${cardTitle(d)}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove(d)
          setManaging(null)
        },
      },
    ])
  }

  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, { paddingHorizontal: inset }]}>{title}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.shelf, { paddingHorizontal: inset }]}>
          {saved.map((doc) => (
            <Pressable
              {...pressHaptic}
              key={doc.id}
              style={pressed(styles.tile)}
              onPress={() => onOpen(doc)}
              onLongPress={() => {
                tick()
                setRenameDraft(null)
                setManaging(managing?.id === doc.id ? null : doc)
              }}
            >
              <CardThumb doc={doc} width={tileWidth} active={managing?.id === doc.id} />
              <Text style={[styles.tileLabel, { maxWidth: tileWidth + 8 }]} numberOfLines={1}>
                {cardTitle(doc)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {managing ? (
        <Panel style={[styles.manageBar, { marginHorizontal: inset }]}>
          {renameDraft !== null ? (
            <TextInput
              style={styles.renameInput}
              value={renameDraft}
              onChangeText={setRenameDraft}
              onSubmitEditing={commitRename}
              onBlur={commitRename}
              placeholder="Card name"
              placeholderTextColor={color.textFaint}
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <PillRow scroll>
              <Pill label="Open" onPress={() => onOpen(managing)} />
              <Pill label="Rename" onPress={() => setRenameDraft(cardTitle(managing))} />
              <Pill
                label="Duplicate"
                onPress={() => {
                  duplicate(managing)
                  setManaging(null)
                  tick()
                }}
              />
              <Pill label="Delete" danger onPress={() => confirmDelete(managing)} />
            </PillRow>
          )}
        </Panel>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { color: color.textDim, fontSize: type.sm },
  shelf: { flexDirection: 'row', gap: 12, paddingVertical: 2 },
  tile: { alignItems: 'center', gap: 6 },
  // the selection ring sits outside the card so choosing never reflows
  ring: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: color.bg2,
  },
  ringActive: { borderColor: color.accent },
  tileLabel: { color: color.textMid, fontSize: type.md },
  manageBar: { marginTop: 4 },
  renameInput: {
    color: color.text,
    fontSize: type.base,
    backgroundColor: color.chip,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    margin: 8,
  },
})
