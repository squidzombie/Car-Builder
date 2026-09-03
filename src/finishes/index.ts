import { Skia, type SkRuntimeEffect } from '@shopify/react-native-skia'
import type { FinishFamily } from '../model/types'
import { SPECTRUM_SKSL } from './spectrum.sksl'
import { GEOMETRIC_SKSL } from './geometric.sksl'
import { FLUID_SKSL } from './fluid.sksl'
import { METALLIC_SKSL } from './metallic.sksl'
import { SPARKLE_SKSL } from './sparkle.sksl'
import { WEAR_SKSL } from './wear.sksl'
import { BEVEL_SKSL } from './bevel.sksl'

export { FINISH_PRESETS, getPreset, makeFinish } from './presets'
export { buildFinishUniforms, buildWearUniforms } from './uniforms'

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

let bevelEffect: SkRuntimeEffect | null = null

/** Compile (once) and return the emboss bevel image-filter effect. */
export function getBevelEffect(): SkRuntimeEffect {
  if (!bevelEffect) {
    const made = Skia.RuntimeEffect.Make(BEVEL_SKSL)
    if (!made) throw new Error('failed to compile bevel shader')
    bevelEffect = made
  }
  return bevelEffect
}

let wearEffect: SkRuntimeEffect | null = null

/** Compile (once) and return the card-condition wear overlay effect. */
export function getWearEffect(): SkRuntimeEffect {
  if (!wearEffect) {
    const made = Skia.RuntimeEffect.Make(WEAR_SKSL)
    if (!made) throw new Error('failed to compile wear shader')
    wearEffect = made
  }
  return wearEffect
}
