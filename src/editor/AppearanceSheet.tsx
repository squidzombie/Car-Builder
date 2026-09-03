import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Color } from '../model/types'
import { useEditor } from '../state/useEditor'
import { Sheet } from './Sheet'
import { ColorPickerBody } from './ColorPicker'
import { FinishSection, SurfaceSection } from './FinishEditor'
import { color, pressed, radius, raised, type } from './theme'
import { pressHaptic } from '../view/haptics'

// Appearance mode (design pass, item 5): one per-layer sheet that holds
// everything about how a layer LOOKS — color, holo finish, and surface —
// behind a segmented switch, so the props bar shows one control instead
// of three and the sheet title is the context. Layers without a color
// (photos) simply don't get the Color tab.

export type AppearanceTab = 'color' | 'finish' | 'surface'

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
  const [tab, setTabState] = useState<AppearanceTab>(
    initialTab === 'color' && !colorProps ? 'finish' : initialTab,
  )
  if (!layer) return null

  const setTab = (t: AppearanceTab) => {
    setTabState(t)
    onTabChange?.(t)
  }

  const tabs: { key: AppearanceTab; label: string }[] = [
    ...(colorProps ? [{ key: 'color' as const, label: 'Color' }] : []),
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
      {tab === 'finish' ? <FinishSection layerId={layerId} /> : null}
      {tab === 'surface' ? <SurfaceSection layerId={layerId} /> : null}
    </Sheet>
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
})
