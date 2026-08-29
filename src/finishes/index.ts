import { Skia, type SkRuntimeEffect } from '@shopify/react-native-skia'
import type { FinishFamily } from '../model/types'
import { SPECTRUM_SKSL } from './spectrum.sksl'
import { GEOMETRIC_SKSL } from './geometric.sksl'
import { FLUID_SKSL } from './fluid.sksl'
import { METALLIC_SKSL } from './metallic.sksl'
import { SPARKLE_SKSL } from './sparkle.sksl'

export { FINISH_PRESETS, getPreset, makeFinish } from './presets'
export { buildFinishUniforms } from './uniforms'

const SOURCES: Record<FinishFamily, string> = {
  spectrum: SPECTRUM_SKSL,
  geometric: GEOMETRIC_SKSL,
  fluid: FLUID_SKSL,
  metallic: METALLIC_SKSL,
  sparkle: SPARKLE_SKSL,
}

const cache = new Map<FinishFamily, SkRuntimeEffect>()

/** Compile (once) and return the runtime effect for a finish family. */
export function getFinishEffect(family: FinishFamily): SkRuntimeEffect {
  let eff = cache.get(family)
  if (!eff) {
    const made = Skia.RuntimeEffect.Make(SOURCES[family])
    if (!made) throw new Error(`failed to compile ${family} finish shader`)
    eff = made
    cache.set(family, eff)
  }
  return eff
}
