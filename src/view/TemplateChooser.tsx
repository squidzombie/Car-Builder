import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'
import { Canvas, Group } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import { defaultViewState, type CardDocument } from '../model/types'
import { TEMPLATES } from '../templates'
import { injectPhoto, type PhotoPick } from '../templates/photo'
import { deleteCard, listCardDocs, persistAsset } from '../model/storage'
import { registerAsset, setAssetUri } from '../model/assets'
import { cutoutAvailable, liftSubject } from '../native/subjectCutout'
import { useDocImages } from './useDocImages'
import { Sheet } from '../editor/Sheet'
import { chip, chipActive, chipText, chipTextActive, color, pressed, radius, raised, type } from '../editor/theme'
import { pressHaptic, tick } from './haptics'

// New-card chooser (M5, §8) with the photo-first quick flow: pick a photo
// first and every template preview renders WITH it, so the first great
// card is one tap away. Saved cards reopen from the shelf (long-press to
// delete). Templates start a fresh document.

const TILE_W = 132
const TILE_H = 185
const MINI_W = 84
const MINI_H = 118

type Props = {
  onPick: (templateId: string, photo?: PhotoPick) => void
  onOpenSaved: (doc: CardDocument) => void
  onClose: () => void
}

type Picked = PhotoPick & { uri: string }

export function TemplateChooser({ onPick, onOpenSaved, onClose }: Props) {
  const { height } = useWindowDimensions()
  const [photo, setPhoto] = useState<Picked | null>(null)
  const [original, setOriginal] = useState<Picked | null>(null)
  const [cutState, setCutState] = useState<'idle' | 'working' | 'none'>('idle')
  const previews = useMemo(
    () =>
      TEMPLATES.filter((t) => !photo || t.id !== 'blank').map((t) => {
        const doc = t.make(`preview-${t.id}`)
        return { template: t, doc: photo ? injectPhoto(doc, photo) : doc }
      }),
    [photo],
  )
  const [saved, setSaved] = useState<CardDocument[]>([])
  useEffect(() => {
    listCardDocs().then(setSaved).catch(() => {})
  }, [])

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    const asset = res.assets?.[0]
    if (res.canceled || !asset) return
    const assetId = registerAsset(asset.uri)
    persistAsset(asset.uri, assetId)
      .then((uri) => setAssetUri(assetId, uri))
      .catch(() => {})
    const picked: Picked = {
      assetId,
      uri: asset.uri,
      w: asset.width ?? 1000,
      h: asset.height ?? 1000,
      cutout: false,
    }
    setPhoto(picked)
    setOriginal(picked)
    setCutState('idle')
    tick()
  }

  const cutOut = async () => {
    if (!original || cutState === 'working') return
    setCutState('working')
    const out = await liftSubject(original.uri)
    if (out) {
      const assetId = registerAsset(out)
      persistAsset(out, assetId)
        .then((uri) => setAssetUri(assetId, uri))
        .catch(() => {})
      setPhoto({ ...original, assetId, uri: out, cutout: true })
      setCutState('idle')
      tick()
    } else {
      setCutState('none')
      setTimeout(() => setCutState('idle'), 2000)
    }
  }

  return (
    <Sheet title="New card" onClose={onClose} closeLabel="Close" backdrop>
      <ScrollView style={{ maxHeight: height * 0.66 }} showsVerticalScrollIndicator={false}>
        <Pressable {...pressHaptic} style={pressed(styles.hero)} onPress={pickPhoto}>
          <View style={styles.heroIcon}>
            <Feather name="camera" size={20} color={color.onAccent} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{photo ? 'Change photo' : 'Start with a photo'}</Text>
            <Text style={styles.heroSub}>
              {photo ? 'Now pick a look below' : 'Pick a photo, then see it in every template'}
            </Text>
          </View>
        </Pressable>

        {photo && cutoutAvailable() ? (
          <View style={styles.cutRow}>
            <Pressable
              {...pressHaptic}
              style={pressed(styles.chip, !photo.cutout && styles.chipActive)}
              onPress={() => original && setPhoto(original)}
            >
              <Text style={[styles.chipText, !photo.cutout && styles.chipTextActive]}>Photo as-is</Text>
            </Pressable>
            <Pressable
              {...pressHaptic}
              style={pressed(styles.chip, photo.cutout && styles.chipActive)}
              onPress={photo.cutout ? undefined : cutOut}
            >
              <Text style={[styles.chipText, photo.cutout && styles.chipTextActive]}>
                {cutState === 'working'
                  ? 'Lifting subject…'
                  : cutState === 'none'
                    ? 'No subject found'
                    : 'Cut out subject'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {saved.length > 0 && !photo ? (
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

        <Text style={styles.sectionTitle}>{photo ? 'Your photo, every look' : 'Templates'}</Text>
        <View style={styles.grid}>
          {previews.map(({ template, doc }) => (
            <TemplateTile
              key={template.id}
              name={template.name}
              doc={doc}
              onPick={() => onPick(template.id, photo ?? undefined)}
            />
          ))}
        </View>
        <Text style={styles.hint}>Your current card is saved automatically</Text>
      </ScrollView>
    </Sheet>
  )
}

function TemplateTile({ name, doc, onPick }: { name: string; doc: CardDocument; onPick: () => void }) {
  const assets = useDocImages(doc)
  return (
    <Pressable {...pressHaptic} style={pressed(styles.tile)} onPress={onPick}>
      <View style={styles.tileCard}>
        <Canvas style={{ width: TILE_W, height: TILE_H }}>
          <Group>
            <CardRenderer
              doc={doc}
              side="front"
              viewState={defaultViewState()}
              assets={assets}
              scale={TILE_W / doc.size.w}
            />
          </Group>
        </Canvas>
      </View>
      <Text style={styles.tileLabel}>{name}</Text>
    </Pressable>
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
    <Pressable {...pressHaptic} style={pressed(styles.tile)} onPress={onOpen} onLongPress={onDelete}>
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: color.bg2,
    borderRadius: radius.xl,
    padding: 14,
    marginBottom: 12,
    ...raised,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...raised,
  },
  heroText: { flex: 1, gap: 2 },
  heroTitle: { color: color.text, fontSize: type.lg, fontWeight: '600' },
  heroSub: { color: color.textDim, fontSize: type.sm },
  cutRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip,
  chipActive,
  chipText,
  chipTextActive,
  sectionTitle: { color: color.textDim, fontSize: type.sm, marginBottom: 8 },
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
  hint: { color: color.textGhost, fontSize: type.xs, textAlign: 'center', paddingTop: 12 },
  shelf: { flexDirection: 'row', gap: 12, paddingVertical: 2, marginBottom: 12 },
})
