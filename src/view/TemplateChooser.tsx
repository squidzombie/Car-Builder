import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'
import type { CardDocument } from '../model/types'
import { TEMPLATES } from '../templates'
import { injectPhoto, type PhotoPick } from '../templates/photo'
import { persistAsset } from '../model/storage'
import { registerAsset, setAssetUri } from '../model/assets'
import { cutoutAvailable, liftSubject } from '../native/subjectCutout'
import { CardThumb, SavedShelf } from './SavedShelf'
import { Sheet } from '../editor/Sheet'
import { Panel, Pill, PillRow } from '../editor/controls'
import { color, pressed, radius, raised, type } from '../editor/theme'
import { pressHaptic, tick } from './haptics'

// New-card chooser (M5, §8) with the photo-first quick flow: pick a photo
// first and every template preview renders WITH it, so the first great
// card is one tap away. Saved cards reopen from the shelf (long-press for
// options). Templates start a fresh document.

const TILE_W = 132

type Props = {
  onPick: (templateId: string, photo?: PhotoPick) => void
  onOpenSaved: (doc: CardDocument) => void
  onClose: () => void
  /** the saved-cards shelf (off when the home screen already shows it) */
  showSaved?: boolean
}

type Picked = PhotoPick & { uri: string }

export function TemplateChooser({ onPick, onOpenSaved, onClose, showSaved = true }: Props) {
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
          <Panel style={styles.cutPanel}>
            <PillRow>
              <Pill label="Photo as-is" active={!photo.cutout} onPress={() => original && setPhoto(original)} />
              <Pill
                label={
                  cutState === 'working'
                    ? 'Lifting subject…'
                    : cutState === 'none'
                      ? 'No subject found'
                      : 'Cut out subject'
                }
                active={photo.cutout}
                onPress={photo.cutout ? undefined : cutOut}
              />
            </PillRow>
          </Panel>
        ) : null}

        {showSaved && !photo ? (
          <View style={styles.savedWrap}>
            <SavedShelf title="Your cards · hold for options" onOpen={onOpenSaved} />
          </View>
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
  return (
    <Pressable {...pressHaptic} style={pressed(styles.tile)} onPress={onPick}>
      <CardThumb doc={doc} width={TILE_W} />
      <Text style={styles.tileLabel}>{name}</Text>
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
  cutPanel: { marginBottom: 12 },
  sectionTitle: { color: color.textDim, fontSize: type.sm, marginBottom: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    rowGap: 16,
  },
  tile: { alignItems: 'center', gap: 6 },
  tileLabel: { color: color.textMid, fontSize: type.md },
  hint: { color: color.textGhost, fontSize: type.xs, textAlign: 'center', paddingTop: 12 },
  savedWrap: { marginBottom: 14 },
})
