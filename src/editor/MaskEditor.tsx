import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Layer, Mask } from '../model/types'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'

// Fade-mask editor (CLAUDE.md §4): linear/radial fades with adjustable
// angle and softness — the classic "player fades into background" look.
// Slider drags are transient updates grouped into one undo step; the
// card stays visible above the sheet, so edits preview live.

type Props = { layerId: string; onClose: () => void }

const LINEAR_DEFAULTS = { angle: 90, start: 0.55, end: 0.95 }
const RADIAL_DEFAULTS = { cx: 0.5, cy: 0.5, inner: 0.45, outer: 0.95 }

export function MaskEditor({ layerId, onClose }: Props) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  if (!layer) return null
  const mask = layer.mask

  const setMask = (next: Mask | undefined) => {
    useEditor.getState().updateLayer(layerId, (l: Layer) => {
      l.mask = next
    })
  }

  const patchParams = (patch: Record<string, number>, transient: boolean) => {
    useEditor.getState().updateLayer(
      layerId,
      (l: Layer) => {
        if (l.mask) l.mask.params = { ...l.mask.params, ...patch }
      },
      { transient },
    )
  }

  const beginSlider = () => useEditor.getState().beginGesture()
  const p = mask?.params ?? {}

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Fade mask · {layer.name}</Text>
          <Pressable style={styles.doneButton} hitSlop={6} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.typeRow}>
          {(
            [
              ['none', 'None'],
              ['linear-fade', 'Linear'],
              ['radial-fade', 'Radial'],
            ] as const
          ).map(([type, label]) => {
            const active = type === 'none' ? !mask : mask?.type === type
            return (
              <Pressable
                key={type}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => {
                  if (type === 'none') setMask(undefined)
                  else if (mask?.type !== type)
                    setMask({
                      type,
                      params: { ...(type === 'linear-fade' ? LINEAR_DEFAULTS : RADIAL_DEFAULTS) },
                    })
                }}
              >
                <Text style={[styles.typeText, active && styles.typeTextActive]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>

        {mask?.type === 'linear-fade' ? (
          <>
            <MiniSlider
              label={`Angle · ${Math.round(p.angle ?? 90)}°`}
              value={p.angle ?? 90}
              min={0}
              max={360}
              step={5}
              onBegin={beginSlider}
              onChange={(v) => patchParams({ angle: v }, true)}
            />
            <MiniSlider
              label={`Fade start · ${(p.start ?? 0.55).toFixed(2)}`}
              value={p.start ?? 0.55}
              min={0}
              max={0.95}
              onBegin={beginSlider}
              onChange={(v) =>
                patchParams({ start: v, end: Math.min(1, v + softness(p)) }, true)
              }
            />
            <MiniSlider
              label={`Softness · ${softness(p).toFixed(2)}`}
              value={softness(p)}
              min={0.02}
              max={0.6}
              onBegin={beginSlider}
              onChange={(v) => patchParams({ end: Math.min(1, (p.start ?? 0.55) + v) }, true)}
            />
          </>
        ) : null}

        {mask?.type === 'radial-fade' ? (
          <>
            <MiniSlider
              label={`Hold · ${(p.inner ?? 0.45).toFixed(2)}`}
              value={p.inner ?? 0.45}
              min={0}
              max={0.9}
              onBegin={beginSlider}
              onChange={(v) =>
                patchParams({ inner: v, outer: Math.min(1.2, v + rsoftness(p)) }, true)
              }
            />
            <MiniSlider
              label={`Softness · ${rsoftness(p).toFixed(2)}`}
              value={rsoftness(p)}
              min={0.02}
              max={0.6}
              onBegin={beginSlider}
              onChange={(v) => patchParams({ outer: Math.min(1.2, (p.inner ?? 0.45) + v) }, true)}
            />
          </>
        ) : null}
      </View>
    </View>
  )
}

const softness = (p: Record<string, number>) =>
  Math.max(0.02, (p.end ?? 0.95) - (p.start ?? 0.55))
const rsoftness = (p: Record<string, number>) =>
  Math.max(0.02, (p.outer ?? 0.95) - (p.inner ?? 0.45))

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#10141f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingBottom: 34,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a3554',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#e6ecf7', fontSize: 15, fontWeight: '600' },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#2a3554',
  },
  doneText: { color: '#e6ecf7', fontSize: 14, fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1c2233',
  },
  typeChipActive: { backgroundColor: '#2a3554', borderWidth: 1, borderColor: '#4da3ff' },
  typeText: { color: '#7f8db0', fontSize: 13 },
  typeTextActive: { color: '#e6ecf7' },
})
