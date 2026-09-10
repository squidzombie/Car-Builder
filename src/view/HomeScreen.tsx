import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTilt } from './useTilt'
import { TiltCard } from './TiltCard'
import { useDocImages } from './useDocImages'
import { SavedShelf, cardTitle } from './SavedShelf'
import { HowItWorks } from './HowItWorks'
import { TemplateChooser } from './TemplateChooser'
import { TEMPLATES } from '../templates'
import { injectPhoto } from '../templates/photo'
import { useEditor } from '../state/useEditor'
import type { EditorIntent } from '../editor/EditorScreen'
import { color, pressed, raised, space, type } from '../editor/theme'
import { pressHaptic } from './haptics'

// Home (M7): the app no longer drops you into a card. The latest card
// tilts as the hero (tap to open it), New card is the one primary action,
// your saved cards sit on a shelf, and "How it works" demonstrates the
// app live, for the first launch and every launch after.

export function HomeScreen({
  onOpenCard,
  onEdit,
}: {
  /** open the card currently in the store (the hero, or a shelf pick) */
  onOpenCard: () => void
  onEdit: (intent: EditorIntent) => void
}) {
  const { width } = useWindowDimensions()
  const { tilt, panHandlers } = useTilt()
  const doc = useEditor((s) => s.doc)
  const assets = useDocImages(doc)
  const [choosing, setChoosing] = useState(false)
  const isSample = doc.id === 'demo-card'
  const heroW = Math.min(Math.round(width * 0.58), 240)

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.wordmark}>Card Builder</Text>

        {/* the signature moment stays on screen: the latest card, tilting */}
        <View style={styles.heroWrap} {...panHandlers}>
          <TiltCard doc={doc} tilt={tilt} width={heroW} assets={assets} onPress={onOpenCard} />
        </View>
        <Pressable {...pressHaptic} style={pressed(styles.heroCaption)} onPress={onOpenCard} hitSlop={8}>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {isSample ? 'Sample card' : cardTitle(doc)}
          </Text>
          <View style={styles.heroOpen}>
            <Text style={styles.heroSub}>{isSample ? 'Tilt it, then make your own' : 'Open'}</Text>
            <Feather name="chevron-right" size={14} color={color.textFaint} />
          </View>
        </Pressable>

        <Pressable {...pressHaptic} style={pressed(styles.cta)} onPress={() => setChoosing(true)}>
          <Feather name="plus" size={18} color={color.onAccent} />
          <Text style={styles.ctaText}>New card</Text>
        </Pressable>

        <SavedShelf
          title="Your cards"
          tileWidth={92}
          inset={space.lg}
          onOpen={(saved) => {
            useEditor.getState().loadDoc(saved)
            onOpenCard()
          }}
        />

        <View style={styles.howto}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <HowItWorks tilt={tilt} />
        </View>
      </ScrollView>

      {choosing ? (
        <TemplateChooser
          showSaved={false}
          onClose={() => setChoosing(false)}
          onPick={(templateId, photo) => {
            const template = TEMPLATES.find((t) => t.id === templateId)
            if (!template) return
            let d = template.make(`card-${Date.now().toString(36)}`)
            if (photo) d = injectPhoto(d, photo)
            useEditor.getState().loadDoc(d)
            setChoosing(false)
            // photo-first: land in the editor with the name ready to type
            onEdit(photo ? 'name' : null)
          }}
          onOpenSaved={(saved) => {
            useEditor.getState().loadDoc(saved)
            setChoosing(false)
            onOpenCard()
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg0 },
  content: { paddingTop: 64, paddingBottom: 48, gap: space.lg },
  wordmark: {
    color: color.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
    paddingHorizontal: space.lg,
  },
  heroWrap: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md },
  heroCaption: { alignItems: 'center', gap: 2, marginTop: -space.sm },
  heroTitle: { color: color.text, fontSize: type.base, fontWeight: '600', maxWidth: 280 },
  heroOpen: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroSub: { color: color.textFaint, fontSize: type.sm },
  cta: {
    marginHorizontal: space.lg,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: color.accent,
    ...raised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: color.onAccent, fontSize: 16, fontWeight: '700' },
  sectionTitle: { color: color.textDim, fontSize: type.sm, paddingHorizontal: space.lg },
  howto: { gap: space.sm, marginTop: space.xs },
})
