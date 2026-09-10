import React, { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { SharedValue } from 'react-native-reanimated'
import type { CardDocument, Layer, ViewState } from '../model/types'
import { CARD_H, CARD_W, DEFAULT_CORNER_RADIUS, defaultTransform } from '../model/types'
import { makeFinish, FINISH_PRESETS } from '../finishes/presets'
import { BORDER_PRESETS } from '../presets/elements'
import { TEMPLATES } from '../templates'
import { TiltCard } from './TiltCard'
import { CardThumb } from './SavedShelf'
import { FinishSwatch } from '../editor/FinishEditor'
import { color, radius, space, type } from '../editor/theme'

// "How it works" (M7 onboarding, CLAUDE.md §11): five swipeable steps, each
// demonstrated live rather than described — the tilt step really tilts
// with the phone, the flip step really flips, the foil step shows the
// real shaders. Lives on the home screen so it is there for anyone, not
// just the first launch.

const STEP_GAP = 12
const VISUAL_H = 168

type Step = { title: string; text: string; visual: React.ReactNode }

/** A small showcase card with no photo slot, so nothing reads as a placeholder. */
function showcaseCard(): CardDocument {
  const now = new Date().toISOString()
  const layer = (partial: Partial<Layer> & Pick<Layer, 'id' | 'name' | 'type'>): Layer => ({
    transform: defaultTransform(),
    opacity: 1,
    blendMode: 'srcOver',
    locked: false,
    visible: true,
    ...partial,
  })
  const border = BORDER_PRESETS.find((p) => p.id === 'refractor')?.build()
  const front: Layer[] = [
    layer({
      id: 'bg',
      name: 'Background',
      type: 'fill',
      fill: {
        paint: {
          gradient: {
            type: 'linear',
            angle: 120,
            stops: [
              { offset: 0, color: '#0b1b3a' },
              { offset: 1, color: '#16305c' },
            ],
          },
        },
      },
      finish: makeFinish('geometric', 'cracked-ice', { intensity: 0.7 }),
    }),
    ...(border?.layers ?? []),
    layer({
      id: 'plate',
      name: 'Name plate',
      type: 'shape',
      transform: { x: 95, y: 760, rotation: -4, scaleX: 1, scaleY: 1 },
      shape: { shapeId: 'rect', paint: { color: '#f1c40f' }, w: 560, h: 150 },
      finish: makeFinish('metallic', 'gold', { intensity: 0.9 }),
    }),
    layer({
      id: 'name',
      name: 'Name',
      type: 'text',
      transform: { x: CARD_W / 2, y: 862, rotation: -4, scaleX: 1, scaleY: 1 },
      text: { content: 'SHINE', font: 'anton', size: 104, color: '#101010', align: 'c' },
    }),
  ]
  const back: Layer[] = [
    layer({
      id: 'bg-back',
      name: 'Background',
      type: 'fill',
      fill: { paint: { color: '#101a30' } },
      finish: makeFinish('fluid', 'lava', { intensity: 0.75 }),
    }),
    layer({
      id: 'back-text',
      name: 'Back',
      type: 'text',
      transform: { x: CARD_W / 2, y: 560, rotation: 0, scaleX: 1, scaleY: 1 },
      text: { content: 'BACK', font: 'bebas', size: 150, color: '#ffffff', align: 'c' },
    }),
  ]
  return {
    id: 'howto-card',
    version: 1,
    size: { w: CARD_W, h: CARD_H },
    cornerRadius: DEFAULT_CORNER_RADIUS,
    palette: { pinned: ['#0b1b3a', '#f1c40f', '#ffffff'], recents: [] },
    shapes: border?.shapes,
    front: { layers: front },
    back: { layers: back },
    meta: { title: 'Sample', createdAt: now, updatedAt: now },
  }
}

export function HowItWorks({ tilt }: { tilt: SharedValue<ViewState> }) {
  const { width: screenW } = useWindowDimensions()
  const stepW = Math.min(300, screenW - 2 * space.lg - 40)
  const [page, setPage] = useState(0)
  const showcase = useMemo(showcaseCard, [])
  const portrait = useMemo(
    () => TEMPLATES.find((t) => t.id === 'portrait')?.make('howto-portrait'),
    [],
  )
  const foils = useMemo(
    () =>
      ['spectrum/refractor', 'geometric/cracked-ice', 'metallic/gold'].map((k) =>
        FINISH_PRESETS.find((p) => `${p.family}/${p.preset}` === k),
      ),
    [],
  )

  const steps: Step[] = [
    {
      title: 'Tilt to shine',
      text: 'Move your phone. The foil moves with it, like a real card in your hand.',
      visual: <TiltCard doc={showcase} tilt={tilt} width={96} onPress={() => {}} />,
    },
    {
      title: 'Tap to flip',
      text: 'Every card has a back. Tap to turn it over.',
      visual: <TiltCard doc={showcase} tilt={tilt} width={96} autoFlipMs={2600} onPress={() => {}} />,
    },
    {
      title: 'Start with a photo',
      text: 'Pick a photo and see it in every template before you choose one.',
      visual: (
        <View style={styles.photoDemo}>
          {portrait ? <CardThumb doc={portrait} width={82} /> : null}
          <View style={styles.badge}>
            <Feather name="camera" size={16} color={color.onAccent} />
          </View>
        </View>
      ),
    },
    {
      title: 'Layers, text, foil',
      text: 'Name plates, stamps and masks — and a holo finish on any layer.',
      visual: (
        <View style={styles.foilRow}>
          {foils.map((p) =>
            p ? (
              <View key={p.preset} style={styles.foil}>
                <FinishSwatch preset={p} size={48} />
              </View>
            ) : null,
          )}
        </View>
      ),
    },
    {
      title: 'Share it',
      text: 'Export a still, or a three-second looping tilt video for social.',
      visual: (
        <View style={styles.shareRow}>
          <View style={styles.shareTile}>
            <Feather name="image" size={20} color={color.text} />
            <Text style={styles.shareLabel}>Image</Text>
          </View>
          <View style={styles.shareTile}>
            <Feather name="video" size={20} color={color.text} />
            <Text style={styles.shareLabel}>Tilt video</Text>
          </View>
        </View>
      ),
    },
  ]

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={stepW + STEP_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.track}
        onScroll={(e) =>
          setPage(Math.max(0, Math.round(e.nativeEvent.contentOffset.x / (stepW + STEP_GAP))))
        }
        scrollEventThrottle={32}
      >
        {steps.map((s, i) => (
          <View key={s.title} style={[styles.step, { width: stepW }]}>
            <View style={styles.visual}>{s.visual}</View>
            <View style={styles.textBlock}>
              <Text style={styles.index}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.text}>{s.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {steps.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  track: { paddingHorizontal: space.lg, gap: STEP_GAP },
  step: {
    backgroundColor: color.bg2,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  visual: {
    height: VISUAL_H,
    margin: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: space.xs, gap: 4 },
  index: { color: color.textGhost, fontSize: type.xs, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  title: { color: color.text, fontSize: type.lg, fontWeight: '600' },
  text: { color: color.textDim, fontSize: type.md, lineHeight: 19 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.hairlineBright },
  dotActive: { backgroundColor: color.accent, width: 16 },
  photoDemo: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -14,
    bottom: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: color.bg0,
  },
  foilRow: { flexDirection: 'row', gap: 10 },
  foil: { borderRadius: radius.md, overflow: 'hidden' },
  shareRow: { flexDirection: 'row', gap: 12 },
  shareTile: {
    width: 92,
    height: 76,
    borderRadius: radius.lg,
    backgroundColor: color.bg2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shareLabel: { color: color.textDim, fontSize: type.sm },
})
