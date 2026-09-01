import type { Finish, FinishFamily } from '../model/types'

// Preset registry (CLAUDE.md §5). Params map to the uP0..uP3 uniforms; the
// meaning of each slot is documented at the top of the family's .sksl.ts file.

export type FinishPreset = {
  family: FinishFamily
  preset: string
  label: string
  bold: boolean // headline preset in v1 UI
  scale: number
  params: Record<string, number>
}

export const FINISH_PRESETS: FinishPreset[] = [
  // Spectrum — p0 lineFreq, p1 lineAngle, p2 wave, p3 bandFreq
  { family: 'spectrum', preset: 'rainbow', label: 'Rainbow', bold: true, scale: 1, params: { p0: 0, p1: 0.9, p2: 0, p3: 1.6 } },
  { family: 'spectrum', preset: 'refractor', label: 'Refractor', bold: true, scale: 1, params: { p0: 26, p1: 1.05, p2: 0, p3: 2.2 } },
  { family: 'spectrum', preset: 'wave-refractor', label: 'Wave Refractor', bold: false, scale: 1, params: { p0: 22, p1: 1.05, p2: 0.8, p3: 2.2 } },

  // Geometric — p0 edgeBrightness, p1 hueSpread, p2 cellSpecular, p3 density
  // (mode 0 voronoi, 1 circle lattice, 2 bismuth hoppers)
  { family: 'geometric', preset: 'cracked-ice', label: 'Cracked Ice', bold: true, scale: 1, params: { p0: 0.9, p1: 0.5, p2: 0.5, p3: 7 } },
  { family: 'geometric', preset: 'mosaic', label: 'Mosaic', bold: false, scale: 1, params: { p0: 0.25, p1: 0.9, p2: 0.4, p3: 12 } },
  { family: 'geometric', preset: 'prizm-facets', label: 'Prizm Facets', bold: false, scale: 1, params: { p0: 0.15, p1: 1.0, p2: 0.9, p3: 9 } },
  { family: 'geometric', preset: 'disco', label: 'Disco', bold: false, scale: 1, params: { p0: 0.35, p1: 1.4, p2: 1.2, p3: 16 } },
  { family: 'geometric', preset: 'circles', label: 'Circles', bold: false, scale: 1, params: { p0: 0.85, p1: 0.7, p2: 0.6, p3: 6, mode: 1 } },
  { family: 'geometric', preset: 'bismuth', label: 'Bismuth', bold: false, scale: 1, params: { p0: 0.9, p1: 1.2, p2: 0.7, p3: 6, mode: 2 } },

  // Fluid — p0 warp, p1 bandFreq, p2 contrast, p3 baseFreq
  { family: 'fluid', preset: 'lava', label: 'Lava', bold: true, scale: 1, params: { p0: 1.6, p1: 1.2, p2: 1.6, p3: 3 } },
  { family: 'fluid', preset: 'oil-slick', label: 'Oil Slick', bold: false, scale: 1, params: { p0: 2.4, p1: 2.6, p2: 1.1, p3: 4 } },
  { family: 'fluid', preset: 'aurora', label: 'Aurora', bold: false, scale: 1, params: { p0: 1.1, p1: 0.8, p2: 1.3, p3: 2 } },
  { family: 'fluid', preset: 'liquid-chrome', label: 'Liquid Chrome', bold: false, scale: 1, params: { p0: 2.0, p1: 0.4, p2: 2.2, p3: 3.5 } },

  // Metallic — p0/p1/p2 tint RGB, p3 brushFreq
  { family: 'metallic', preset: 'gold', label: 'Gold', bold: true, scale: 1, params: { p0: 1.0, p1: 0.78, p2: 0.35, p3: 90 } },
  { family: 'metallic', preset: 'silver', label: 'Silver', bold: false, scale: 1, params: { p0: 0.88, p1: 0.9, p2: 0.95, p3: 90 } },
  { family: 'metallic', preset: 'chrome', label: 'Chrome', bold: false, scale: 1, params: { p0: 0.85, p1: 0.88, p2: 0.92, p3: 0 } },
  { family: 'metallic', preset: 'rose-gold', label: 'Rose Gold', bold: false, scale: 1, params: { p0: 1.0, p1: 0.62, p2: 0.55, p3: 90 } },

  // Sparkle — p0 density, p1 fleckSize, p2 twinkleSharpness, p3 colored
  { family: 'sparkle', preset: 'glitter', label: 'Glitter', bold: false, scale: 1, params: { p0: 60, p1: 0.35, p2: 8, p3: 1 } },
  { family: 'sparkle', preset: 'starfield', label: 'Starfield', bold: false, scale: 1, params: { p0: 24, p1: 0.22, p2: 14, p3: 0 } },
]

export function getPreset(family: FinishFamily, preset: string): FinishPreset | undefined {
  return FINISH_PRESETS.find((p) => p.family === family && p.preset === preset)
}

/** Build a Finish from a preset with default intensity/scale. */
export function makeFinish(
  family: FinishFamily,
  preset: string,
  overrides?: Partial<Pick<Finish, 'intensity' | 'scale' | 'paletteMode' | 'customColors'>>,
): Finish {
  const p = getPreset(family, preset)
  if (!p) throw new Error(`unknown finish preset ${family}/${preset}`)
  return {
    family,
    preset,
    intensity: overrides?.intensity ?? 0.85,
    scale: overrides?.scale ?? p.scale,
    paletteMode: overrides?.paletteMode ?? 'rainbow',
    customColors: overrides?.customColors,
    params: { ...p.params },
  }
}
