import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Color, Layer } from '../model/types'
import { useEditor } from '../state/useEditor'
import { Sheet } from './Sheet'
import { ColorPickerBody } from './ColorPicker'
import { FinishSection, SurfaceSection } from './FinishEditor'
import { MiniSlider } from './MiniSlider'
import { color, pressed, radius, raised, type } from './theme'
import { pressHaptic } from '../view/haptics'

// Appearance mode (design pass, item 5): one per-layer sheet that holds
// everything about how a layer LOOKS — color (or photo adjustments for
// images), holo finish, and surface — behind a segmented switch, so the
// props bar shows one control instead of three and the sheet title is
// the context.

export type AppearanceTab = 'color' | 'adjust' | 'finish' | 'surface'

type ColorProps = {
  value: Color
  onChange: (c: Color, transient: boolean) => void
  onGestureStart: () => void
  onEyedropper: () => void
}

type Props = {
  layerId: string
  initialTab: AppearanceTab
  /** null when the layer has no editable color (images) */
  color: ColorProps | null
  onClose: () => void
  onTabChange?: (tab: AppearanceTab) => void
}

export function AppearanceSheet({ layerId, initialTab, color: colorProps, onClose, onTabChange }: Props) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  const isImage = layer?.type === 'image'
  const [tab, setTabState] = useState<AppearanceTab>(() => {
    if (initialTab === 'color' && !colorProps) return isImage ? 'adjust' : 'finish'
    if (initialTab === 'adjust' && !isImage) return colorProps ? 'color' : 'finish'
    return initialTab
  })
  if (!layer) return null

  const setTab = (t: AppearanceTab) => {
    setTabState(t)
    onTabChange?.(t)
  }

  const tabs: { key: AppearanceTab; label: string }[] = [
    ...(colorProps ? [{ key: 'color' as const, label: 'Color' }] : []),
    ...(isImage ? [{ key: 'adjust' as const, label: 'Adjust' }] : []),
    { key: 'finish', label: 'Finish' },
    { key: 'surface', label: 'Surface' },
  ]

  return (
    <Sheet title={`Appearance · ${layer.name}`} onClose={onClose}>
      <View style={styles.segments}>
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <Pressable
              {...pressHaptic}
              key={t.key}
              style={pressed(styles.segment, active && styles.segmentActive)}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {tab === 'color' && colorProps ? <ColorPickerBody {...colorProps} /> : null}
      {tab === 'adjust' && isImage ? <AdjustSection layerId={layerId} /> : null}
      {tab === 'finish' ? <FinishSection layerId={layerId} /> : null}
      {tab === 'surface' ? <SurfaceSection layerId={layerId} /> : null}
    </Sheet>
  )
}

/** Photo adjustments: brightness, contrast, saturation (ColorMatrix in the renderer). */
function AdjustSection({ layerId }: { layerId: string }) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  if (!layer?.image) return null
  const a = layer.image.adjust ?? { brightness: 0, contrast: 0, saturation: 1 }
  const patch = (next: Partial<typeof a>, transient = true) =>
    useEditor.getState().updateLayer(
      layerId,
      (l: Layer) => {
        if (l.image) l.image.adjust = { ...a, ...next }
      },
      { transient },
    )
  const begin = () => useEditor.getState().beginGesture()
  const neutral = a.brightness === 0 && a.contrast === 0 && a.saturation === 1
  return (
    <>
      <MiniSlider
        label={`Brightness · ${a.brightness >= 0 ? '+' : ''}${Math.round(a.brightness * 100)}`}
        value={a.brightness}
        min={-0.5}
        max={0.5}
        onBegin={begin}
        onChange={(v) => patch({ brightness: v })}
      />
      <MiniSlider
        label={`Contrast · ${a.contrast >= 0 ? '+' : ''}${Math.round(a.contrast * 100)}`}
        value={a.contrast}
        min={-0.5}
        max={0.5}
        onBegin={begin}
        onChange={(v) => patch({ contrast: v })}
      />
      <MiniSlider
        label={`Saturation · ${Math.round(a.saturation * 100)}%`}
        value={a.saturation}
        min={0}
        max={2}
        onBegin={begin}
        onChange={(v) => patch({ saturation: v })}
      />
      <Pressable
        {...pressHaptic}
        style={pressed(styles.reset, neutral && styles.resetDisabled)}
        disabled={neutral}
        onPress={() =>
          useEditor.getState().updateLayer(layerId, (l: Layer) => {
            if (l.image) l.image.adjust = undefined
          })
        }
      >
        <Text style={styles.resetText}>Reset to as shot</Text>
      </Pressable>
    </>
  )
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    backgroundColor: color.track,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: color.chipActive, ...raised },
  segmentText: { color: color.textDim, fontSize: type.md },
  segmentTextActive: { color: color.accent, fontWeight: '600' },
  reset: {
    alignSelf: 'center',
    minHeight: 34,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: color.chip,
    alignItems: 'center',
    justifyContent: 'center',
    ...raised,
  },
  resetDisabled: { opacity: 0.35 },
  resetText: { color: color.textMid, fontSize: type.md },
})
