import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Canvas, LinearGradient, Rect, Shader, vec } from '@shopify/react-native-skia'
import { lightFromTilt, type FinishFamily, type Layer, type ViewState } from '../model/types'
import { FINISH_PRESETS, makeFinish, type FinishPreset } from '../finishes/presets'
import { getFinishEffect } from '../finishes'
import { buildFinishUniforms } from '../finishes/uniforms'
import { useEditor } from '../state/useEditor'
import { MiniSlider } from './MiniSlider'
import { Hint, Panel, Pill, PillRow, TILE, Tile, TileRow } from './controls'
import { color, type } from './theme'

// Finish + Surface sections of the Appearance sheet (M4, CLAUDE.md §5):
// per-layer family + preset, intensity and pattern scale, palette mode
// ('custom' feeds the card's pinned swatches into the holo shader, §6),
// and the emboss surface. The editor canvas sweeps its tilt while these
// are open, so the finish shimmers live as you tune it.
//
// This picker is the reference for the app's option language (approved
// v3): the family strip and its presets share ONE panel, the open family
// is a filled pill on that surface, presets are live shader tiles.

const FAMILIES: { key: FinishFamily; label: string }[] = [
  { key: 'spectrum', label: 'Spectrum' },
  { key: 'geometric', label: 'Geometric' },
  { key: 'fluid', label: 'Fluid' },
  { key: 'metallic', label: 'Metallic' },
  { key: 'sparkle', label: 'Sparkle' },
]

const usePatch = (layerId: string) => (fn: (l: Layer) => void, transient = false) =>
  useEditor.getState().updateLayer(layerId, fn, { transient })

export function FinishSection({ layerId }: { layerId: string }) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  const pinned = useEditor((s) => s.doc.palette.pinned)
  const [family, setFamily] = React.useState<FinishFamily>(layer?.finish?.family ?? 'spectrum')
  const patch = usePatch(layerId)
  if (!layer) return null
  const finish = layer.finish

  const pickPreset = (fam: FinishFamily, preset: string) => {
    patch((l) => {
      l.finish = makeFinish(fam, preset, {
        intensity: l.finish?.intensity ?? 0.85,
        paletteMode: l.finish?.paletteMode ?? 'rainbow',
      })
    })
  }

  const setPaletteMode = (mode: 'rainbow' | 'custom') =>
    patch((l) => {
      if (l.finish) {
        l.finish.paletteMode = mode
        l.finish.customColors = undefined
      }
    })

  return (
    <>
      <Panel>
        <PillRow scroll style={styles.famRow}>
          <Pill label="None" active={!finish} onPress={() => patch((l) => (l.finish = undefined))} />
          {FAMILIES.map((f) => (
            <Pill key={f.key} label={f.label} active={family === f.key} onPress={() => setFamily(f.key)} />
          ))}
        </PillRow>
        <TileRow scroll>
          {FINISH_PRESETS.filter((p) => p.family === family).map((p) => (
            <Tile
              key={p.preset}
              caption={p.label}
              active={finish?.family === p.family && finish?.preset === p.preset}
              onPress={() => pickPreset(p.family, p.preset)}
            >
              <FinishSwatch preset={p} />
            </Tile>
          ))}
        </TileRow>
      </Panel>

      {finish ? (
        <>
          <MiniSlider
            label={`Intensity · ${finish.intensity.toFixed(2)}`}
            value={finish.intensity}
            min={0.1}
            max={1}
            onBegin={() => useEditor.getState().beginGesture()}
            onChange={(v) => patch((l) => void (l.finish && (l.finish.intensity = v)), true)}
          />
          <MiniSlider
            label={`Pattern scale · ${finish.scale.toFixed(2)}`}
            value={finish.scale}
            min={0.4}
            max={2.5}
            onBegin={() => useEditor.getState().beginGesture()}
            onChange={(v) => patch((l) => void (l.finish && (l.finish.scale = v)), true)}
          />
          {/* the band colors, shown as what they are: a hue sweep, or the
              card's own pinned palette */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Colors</Text>
            <Tile
              caption="Rainbow"
              width={BAND_W}
              height={BAND_H}
              active={finish.paletteMode === 'rainbow'}
              onPress={() => setPaletteMode('rainbow')}
            >
              <BandSwatch colors={RAINBOW} />
            </Tile>
            <Tile
              caption="Card palette"
              width={BAND_W}
              height={BAND_H}
              active={finish.paletteMode === 'custom'}
              onPress={() => setPaletteMode('custom')}
            >
              <BandSwatch colors={pinned.length >= 2 ? pinned : pinned.length === 1 ? [pinned[0], pinned[0]] : EMPTY_BAND} />
            </Tile>
          </View>
        </>
      ) : (
        <Hint>Pick a pattern to give this layer a holo finish</Hint>
      )}
    </>
  )
}

export function SurfaceSection({ layerId }: { layerId: string }) {
  const side = useEditor((s) => s.side)
  const layer = useEditor((s) => s.doc[side].layers.find((l) => l.id === layerId))
  const patch = usePatch(layerId)
  if (!layer) return null
  const options = [
    ['flat', 'Flat'],
    ['raised', 'Raised'],
    ['inset', 'Inset'],
  ] as const
  return (
    <>
      <Panel>
        <PillRow>
          {options.map(([key, label]) => {
            const active = key === 'flat' ? !layer.emboss : layer.emboss?.style === key
            return (
              <Pill
                key={key}
                label={label}
                active={active}
                onPress={() =>
                  patch((l) => {
                    l.emboss =
                      key === 'flat' ? undefined : { height: l.emboss?.height ?? 0.5, style: key }
                  })
                }
              />
            )
          })}
        </PillRow>
      </Panel>
      {layer.emboss ? (
        <MiniSlider
          label={`Depth · ${layer.emboss.height.toFixed(2)}`}
          value={layer.emboss.height}
          min={0.1}
          max={1}
          onBegin={() => useEditor.getState().beginGesture()}
          onChange={(v) => patch((l) => void (l.emboss && (l.emboss.height = v)), true)}
        />
      ) : (
        <Hint>Raised ink catches the light as the card tilts</Hint>
      )}
    </>
  )
}

const SWATCH_VIEW: ViewState = { tiltX: 0.4, tiltY: -0.25, ...lightFromTilt(0.4, -0.25) }

/** Live render of a finish preset (the real shader at a fixed tilt). */
export function FinishSwatch({ preset, size = TILE }: { preset: FinishPreset; size?: number }) {
  const uniforms = useMemo(
    () =>
      buildFinishUniforms(makeFinish(preset.family, preset.preset), SWATCH_VIEW, {
        w: size,
        h: size,
      }),
    [preset, size],
  )
  return (
    <Canvas style={{ width: size, height: size, backgroundColor: color.bg0 }}>
      <Rect x={0} y={0} width={size} height={size}>
        <Shader source={getFinishEffect(preset.family)} uniforms={uniforms} />
      </Rect>
    </Canvas>
  )
}

const BAND_W = 72
const BAND_H = 36
const RAINBOW = ['#ff3b30', '#ffcc00', '#34c759', '#00c7be', '#4da3ff', '#af52de', '#ff3b30']
const EMPTY_BAND = [color.textGhost, color.textGhost]

/** A horizontal band of colors — what the holo's color sweep will use. */
function BandSwatch({ colors }: { colors: string[] }) {
  return (
    <Canvas style={{ width: BAND_W, height: BAND_H }}>
      <Rect x={0} y={0} width={BAND_W} height={BAND_H}>
        <LinearGradient start={vec(0, 0)} end={vec(BAND_W, 0)} colors={colors} />
      </Rect>
    </Canvas>
  )
}

const styles = StyleSheet.create({
  famRow: { paddingBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { color: color.textDim, fontSize: type.sm, marginRight: 4 },
})
