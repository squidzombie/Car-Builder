import React from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { Color, Layer } from '../model/types'
import { FONT_CHOICES } from '../renderer/fonts'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'
import { Sheet, type SheetFrame } from './Sheet'
import { Panel, Pill, PillRow, Segmented, TILE, Tile, TileRow } from './controls'
import { color, pillText, pillTextActive, pressed, radius, type } from './theme'
import { pressHaptic } from '../view/haptics'

// Text layer editor (M3, §4 basics): content, font, size, alignment — plus
// outline and shadow, the two things that make a name read over a photo
// the way real card typography does. Edits are transient inside one
// gesture group per control interaction; the card stays visible above
// the sheet for live preview. Every choice shows itself: font pills are
// set in their own face, alignment is glyphs, shadows are live samples.

type Props = { layerId: string; onClose: () => void; onFrame?: (f: SheetFrame | null) => void }

type TextShadow = NonNullable<NonNullable<Layer['text']>['shadow']>
type Align = NonNullable<Layer['text']>['align']

const SHADOWS: { key: string; label: string; value: TextShadow }[] = [
  { key: 'soft', label: 'Soft', value: { color: '#000000a0', dx: 0, dy: 5, blur: 9 } },
  { key: 'hard', label: 'Hard', value: { color: '#000000', dx: 5, dy: 5, blur: 0 } },
  { key: 'glow', label: 'Glow', value: { color: '#ffffffb0', dx: 0, dy: 0, blur: 12 } },
]

const ALIGNS: { key: Align; icon: 'align-left' | 'align-center' | 'align-right' }[] = [
  { key: 'l', icon: 'align-left' },
  { key: 'c', icon: 'align-center' },
  { key: 'r', icon: 'align-right' },
]

const ORIENTATIONS: { key: 'h' | 'v'; label: string }[] = [
  { key: 'h', label: 'Across' },
  { key: 'v', label: 'Stacked' },
]

/** -180..180 for the angle slider, whatever the stored rotation is */
const wrapAngle = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

export function TextEditor({ layerId, onClose, onFrame }: Props) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  const pinned = useEditor((s) => s.doc.palette.pinned)
  if (!layer?.text) return null
  const t = layer.text

  const patch = (fn: (l: Layer) => void, transient = true) => {
    useEditor.getState().updateLayer(layerId, fn, { transient })
  }

  const outlineColors: Color[] = ['#000000', '#ffffff', ...pinned.slice(0, 5)]
  const shadowKey = t.shadow
    ? SHADOWS.find((s) => JSON.stringify(s.value) === JSON.stringify(t.shadow))?.key ?? 'custom'
    : 'none'

  return (
    <Sheet title={`Text · ${layer.name}`} onClose={onClose} onFrame={onFrame}>
      {/* 'words', not 'characters': the latter locks the keyboard in caps
          after every letter (feedback) — caps lock is the user's call */}
      <TextInput
        style={styles.input}
        value={t.content}
        onFocus={() => useEditor.getState().beginGesture()}
        onChangeText={(content) => patch((l) => (l.text!.content = content))}
        autoCapitalize="words"
        autoCorrect={false}
        multiline={false}
      />

      <Panel>
        <PillRow scroll>
          {FONT_CHOICES.map((f) => {
            const active = t.font === f.key
            return (
              <Pill key={f.key} active={active} onPress={() => patch((l) => (l.text!.font = f.key), false)}>
                <Text
                  style={[
                    styles.fontText,
                    active && styles.fontTextActive,
                    f.family ? { fontFamily: f.family } : null,
                  ]}
                >
                  {f.label}
                </Text>
              </Pill>
            )
          })}
        </PillRow>
      </Panel>

      <View style={styles.row}>
        <View style={styles.grow}>
          <MiniSlider
            label={`Size · ${Math.round(t.size)}`}
            value={t.size}
            min={20}
            max={180}
            step={2}
            onBegin={() => useEditor.getState().beginGesture()}
            onChange={(v) => patch((l) => (l.text!.size = v))}
          />
        </View>
        <Segmented<Align>
          items={ALIGNS}
          value={t.align}
          onChange={(a) => patch((l) => (l.text!.align = a), false)}
          style={styles.alignTrack}
        />
      </View>

      {/* orientation: across or stacked, plus free rotation (the rotate
          handle on the canvas snaps to 45°; this is the fine control) */}
      <View style={styles.row}>
        <View style={styles.grow}>
          <MiniSlider
            label={`Angle · ${Math.round(wrapAngle(layer.transform.rotation))}°`}
            value={wrapAngle(layer.transform.rotation)}
            min={-180}
            max={180}
            step={1}
            onBegin={() => useEditor.getState().beginGesture()}
            onChange={(v) => patch((l) => (l.transform.rotation = v))}
          />
        </View>
        <Segmented<'h' | 'v'>
          items={ORIENTATIONS}
          value={t.orientation ?? 'h'}
          onChange={(o) => patch((l) => (l.text!.orientation = o === 'v' ? 'v' : undefined), false)}
          style={styles.alignTrack}
        />
      </View>

      {/* outline: none, or a color from black/white/the card's pins */}
      <Panel>
        <PillRow scroll>
          <Text style={styles.groupLabel}>Outline</Text>
          <Pressable
            {...pressHaptic}
            style={pressed(styles.swatch, !t.outline && styles.swatchActive)}
            onPress={() => patch((l) => (l.text!.outline = undefined), false)}
            accessibilityLabel="No outline"
          >
            <View style={[styles.swatchFill, styles.swatchNone]}>
              <Feather name="slash" size={14} color={color.textDim} />
            </View>
          </Pressable>
          {outlineColors.map((c) => {
            const active = t.outline?.color === c
            return (
              <Pressable
                {...pressHaptic}
                key={c}
                style={pressed(styles.swatch, active && styles.swatchActive)}
                onPress={() =>
                  patch(
                    (l) => (l.text!.outline = { color: c, width: l.text!.outline?.width ?? 6 }),
                    false,
                  )
                }
              >
                <View style={[styles.swatchFill, { backgroundColor: c }]} />
              </Pressable>
            )
          })}
        </PillRow>
      </Panel>
      {t.outline ? (
        <MiniSlider
          label={`Outline width · ${Math.round(t.outline.width)}`}
          value={t.outline.width}
          min={1}
          max={18}
          step={1}
          onBegin={() => useEditor.getState().beginGesture()}
          onChange={(v) => patch((l) => void (l.text!.outline && (l.text!.outline.width = v)))}
        />
      ) : null}

      {/* shadow: live samples of each preset */}
      <Panel>
        <TileRow scroll>
          <Tile caption="None" active={shadowKey === 'none'} onPress={() => patch((l) => (l.text!.shadow = undefined), false)}>
            <ShadowSample />
          </Tile>
          {SHADOWS.map((s) => (
            <Tile
              key={s.key}
              caption={s.label}
              active={shadowKey === s.key}
              onPress={() => patch((l) => (l.text!.shadow = { ...s.value }), false)}
            >
              <ShadowSample shadow={s.value} />
            </Tile>
          ))}
        </TileRow>
      </Panel>
    </Sheet>
  )
}

/** "Aa" on a mid-grey ground so both dark shadows and light glows read. */
function ShadowSample({ shadow }: { shadow?: TextShadow }) {
  const k = 0.5 // card px → tile px
  return (
    <View style={styles.sampleGround}>
      <Text
        style={[
          styles.sampleText,
          shadow
            ? {
                textShadowColor: shadow.color,
                textShadowOffset: { width: shadow.dx * k, height: shadow.dy * k },
                textShadowRadius: Math.max(0.01, shadow.blur * k),
              }
            : null,
        ]}
      >
        Aa
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  input: {
    color: color.text,
    fontSize: 16,
    backgroundColor: color.chip,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  grow: { flex: 1 },
  alignTrack: { marginBottom: 8 },
  fontText: { ...pillText, fontSize: 15 },
  fontTextActive: { ...pillTextActive, fontWeight: undefined },
  groupLabel: { color: color.textDim, fontSize: type.sm, marginRight: 6, marginLeft: 6 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: color.swatchBack,
  },
  swatchActive: { borderColor: color.accent },
  swatchFill: { flex: 1 },
  swatchNone: { backgroundColor: color.chip, alignItems: 'center', justifyContent: 'center' },
  sampleGround: {
    width: TILE,
    height: TILE,
    backgroundColor: '#5b5b63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleText: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
})
