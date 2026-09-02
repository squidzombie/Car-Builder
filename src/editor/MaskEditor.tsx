import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Layer, Mask } from '../model/types'
import { useEditor } from '../state/useEditor'
import { BUILTIN_SHAPES } from '../model/shapes'
import { layerBounds } from './bounds'
import { ShapeGlyph } from './ToolBar'
import { MiniSlider } from './MiniSlider'
import { Sheet } from './Sheet'
import { chip, chipActive, chipText, chipTextActive, color, pressed, radius } from './theme'

// Mask editor (CLAUDE.md §4): linear/radial fades — the classic "player
// fades into background" look — plus shape masks: clip the layer to a
// circle, hexagon, or any custom/drawn shape (pairs with the subject
// cutout). Slider drags are transient updates grouped into one undo
// step; the card stays visible above the sheet, so edits preview live.

type Props = { layerId: string; onClose: () => void }

const LINEAR_DEFAULTS = { angle: 90, start: 0.55, end: 0.95 }
const RADIAL_DEFAULTS = { cx: 0.5, cy: 0.5, inner: 0.45, outer: 0.95 }

export function MaskEditor({ layerId, onClose }: Props) {
  const side = useEditor((s) => s.side)
  const doc = useEditor((s) => s.doc)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  if (!layer) return null
  const mask = layer.mask
  const allShapes = [...BUILTIN_SHAPES, ...(doc.shapes ?? [])]

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
    <Sheet title={`Mask · ${layer.name}`} onClose={onClose}>
      <View style={styles.typeRow}>
          {(
            [
              ['none', 'None'],
              ['linear-fade', 'Linear'],
              ['radial-fade', 'Radial'],
              ['shape', 'Shape'],
            ] as const
          ).map(([type, label]) => {
            const active = type === 'none' ? !mask : mask?.type === type
            return (
              <Pressable
                key={type}
                style={pressed(styles.typeChip, active && styles.typeChipActive)}
                onPress={() => {
                  if (type === 'none') setMask(undefined)
                  else if (mask?.type !== type) {
                    if (type === 'shape') {
                      // fit the shape window to the layer as it stands
                      const b = layerBounds(layer, doc)
                      setMask({
                        type,
                        assetId: 'circle',
                        params: {
                          x: b.x,
                          y: b.y,
                          w: b.w,
                          h: b.h,
                          cx: b.x + b.w / 2,
                          cy: b.y + b.h / 2,
                          bw: b.w,
                          bh: b.h,
                          s: 1,
                        },
                      })
                    } else {
                      setMask({
                        type,
                        params: { ...(type === 'linear-fade' ? LINEAR_DEFAULTS : RADIAL_DEFAULTS) },
                      })
                    }
                  }
                }}
              >
                <Text style={[styles.typeText, active && styles.typeTextActive]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>

        {mask?.type === 'shape' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.shapeRow}>
                {allShapes.map((sh) => (
                  <Pressable
                    key={sh.id}
                    style={pressed(styles.shapeChip, mask.assetId === sh.id && styles.shapeChipActive)}
                    onPress={() =>
                      useEditor.getState().updateLayer(layerId, (l: Layer) => {
                        if (l.mask) l.mask.assetId = sh.id
                      })
                    }
                  >
                    <ShapeGlyph shape={sh} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <MiniSlider
              label={`Size · ${(p.s ?? 1).toFixed(2)}`}
              value={p.s ?? 1}
              min={0.4}
              max={1.6}
              onBegin={beginSlider}
              onChange={(v) => {
                const bw = p.bw ?? 100
                const bh = p.bh ?? 100
                const cx = p.cx ?? 0
                const cy = p.cy ?? 0
                patchParams(
                  { s: v, w: bw * v, h: bh * v, x: cx - (bw * v) / 2, y: cy - (bh * v) / 2 },
                  true,
                )
              }}
            />
          </>
        ) : null}

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
    </Sheet>
  )
}

const softness = (p: Record<string, number>) =>
  Math.max(0.02, (p.end ?? 0.95) - (p.start ?? 0.55))
const rsoftness = (p: Record<string, number>) =>
  Math.max(0.02, (p.outer ?? 0.95) - (p.inner ?? 0.45))

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: chip,
  typeChipActive: chipActive,
  typeText: chipText,
  typeTextActive: chipTextActive,
  shapeRow: { flexDirection: 'row', gap: 6 },
  shapeChip: {
    minWidth: 40,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: color.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  shapeChipActive: { backgroundColor: color.chipActive, borderWidth: 1, borderColor: color.accent },
})
