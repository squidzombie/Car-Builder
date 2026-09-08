import React from 'react'
import type { ConditionPreset } from '../model/types'
import { useEditor } from '../state/useEditor'
import { Sheet } from '../editor/Sheet'
import { MiniSlider } from '../editor/MiniSlider'
import { Hint, Panel, Pill, PillRow } from '../editor/controls'

// Card condition / grade (Build 4): a card-level, tilt-reactive wear
// overlay — scratches that glint, whitened edges, scuffed corners. The
// card stays visible above the sheet, so changes preview live.

const PRESETS: [ConditionPreset | null, string][] = [
  [null, 'Pristine'],
  ['mint', 'Mint'],
  ['near-mint', 'Near mint'],
  ['played', 'Played'],
  ['heavily-played', 'Heavy'],
]

export function ConditionSheet({ onClose }: { onClose: () => void }) {
  const condition = useEditor((s) => s.doc.condition)

  const setPreset = (preset: ConditionPreset | null) => {
    useEditor.getState().apply((doc) => {
      doc.condition = preset
        ? { preset, intensity: doc.condition?.intensity ?? 0.8 }
        : undefined
    })
  }

  return (
    <Sheet title="Condition" onClose={onClose}>
      <Panel>
        <PillRow scroll>
          {PRESETS.map(([preset, label]) => (
            <Pill
              key={label}
              label={label}
              active={preset === null ? !condition : condition?.preset === preset}
              onPress={() => setPreset(preset)}
            />
          ))}
        </PillRow>
      </Panel>
      {condition ? (
        <MiniSlider
          label={`Wear · ${condition.intensity.toFixed(2)}`}
          value={condition.intensity}
          min={0.1}
          max={1}
          onBegin={() => useEditor.getState().beginGesture()}
          onChange={(v) =>
            useEditor
              .getState()
              .applyTransient((doc) => void (doc.condition && (doc.condition.intensity = v)))
          }
        />
      ) : (
        <Hint>Tilt the card to see the wear catch the light</Hint>
      )}
    </Sheet>
  )
}
