import React from 'react'
import { StyleSheet } from 'react-native'
import { Canvas, Circle, LinearGradient, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import type { Layer, Mask } from '../model/types'
import { useEditor } from '../state/useEditor'
import { BUILTIN_SHAPES } from '../model/shapes'
import { layerBounds } from './bounds'
import { ShapeGlyph } from './ToolBar'
import { MiniSlider } from './MiniSlider'
import { Sheet, type SheetFrame } from './Sheet'
import { Panel, Pill, PillRow, TILE, Tile, TileRow } from './controls'
import { color } from './theme'

// Mask editor (CLAUDE.md §4): linear/radial fades — the classic "player
// fades into background" look — plus shape masks: clip the layer to a
// circle, hexagon, or any custom/drawn shape (pairs with the subject
// cutout). Slider drags are transient updates grouped into one undo
// step; the card stays visible above the sheet, so edits preview live.
// Mask types are picked from tiles that show the fade itself; the shape
// strip flows into the same panel when Shape is the open type.

type Props = { layerId: string; onClose: () => void; onFrame?: (f: SheetFrame | null) => void }

const LINEAR_DEFAULTS = { angle: 90, start: 0.55, end: 0.95 }
const RADIAL_DEFAULTS = { cx: 0.5, cy: 0.5, inner: 0.45, outer: 0.95 }

type MaskKind = 'none' | Mask['type']

const KINDS: { key: MaskKind; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'linear-fade', label: 'Linear' },
  { key: 'radial-fade', label: 'Radial' },
  { key: 'shape', label: 'Shape' },
]

export function MaskEditor({ layerId, onClose, onFrame }: Props) {
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

  const pickKind = (kind: MaskKind) => {
    if (kind === 'none') {
      setMask(undefined)
      return
    }
    if (mask?.type === kind) return
    if (kind === 'shape') {
      // fit the shape window to the layer as it stands
      const b = layerBounds(layer, doc)
      setMask({
        type: kind,
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
        type: kind,
        params: { ...(kind === 'linear-fade' ? LINEAR_DEFAULTS : RADIAL_DEFAULTS) },
      })
    }
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
  const current: MaskKind = mask?.type ?? 'none'

  return (
    <Sheet title={`Mask · ${layer.name}`} onClose={onClose} onFrame={onFrame}>
      <Panel>
        <TileRow>
          {KINDS.map((k) => (
            <Tile key={k.key} caption={k.label} active={current === k.key} onPress={() => pickKind(k.key)}>
              <MaskPreview kind={k.key} />
            </Tile>
          ))}
        </TileRow>
        {mask?.type === 'shape' ? (
          <PillRow scroll style={styles.shapeRow}>
            {allShapes.map((sh) => (
              <Pill
                key={sh.id}
                active={mask.assetId === sh.id}
                style={styles.shapePill}
                onPress={() =>
                  useEditor.getState().updateLayer(layerId, (l: Layer) => {
                    if (l.mask) l.mask.assetId = sh.id
                  })
                }
              >
                <ShapeGlyph shape={sh} />
              </Pill>
            ))}
          </PillRow>
        ) : null}
      </Panel>

      {mask?.type === 'shape' ? (
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
            onChange={(v) => patchParams({ start: v, end: Math.min(1, v + softness(p)) }, true)}
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
            onChange={(v) => patchParams({ inner: v, outer: Math.min(1.2, v + rsoftness(p)) }, true)}
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

const INK = color.glyph
const CLEAR = 'rgba(197,197,204,0)'
const PAD = 8

/** What each mask does, drawn on a layer-shaped block. */
function MaskPreview({ kind }: { kind: MaskKind }) {
  const s = TILE
  const w = s - PAD * 2
  return (
    <Canvas style={{ width: s, height: s }}>
      {kind === 'none' ? (
        <RoundedRect x={PAD} y={PAD} width={w} height={w} r={4} color={INK} />
      ) : null}
      {kind === 'linear-fade' ? (
        <Rect x={PAD} y={PAD} width={w} height={w}>
          <LinearGradient
            start={vec(0, PAD)}
            end={vec(0, PAD + w)}
            colors={[INK, INK, CLEAR]}
            positions={[0, 0.4, 0.95]}
          />
        </Rect>
      ) : null}
      {kind === 'radial-fade' ? (
        <Rect x={PAD} y={PAD} width={w} height={w}>
          <RadialGradient c={vec(s / 2, s / 2)} r={w * 0.62} colors={[INK, CLEAR]} positions={[0.4, 1]} />
        </Rect>
      ) : null}
      {kind === 'shape' ? <Circle cx={s / 2} cy={s / 2} r={w / 2} color={INK} /> : null}
    </Canvas>
  )
}

const styles = StyleSheet.create({
  shapeRow: { paddingTop: 0 },
  shapePill: { minWidth: 44, paddingHorizontal: 8 },
})
