/**
 * @jest-environment node
 *
 * Compiles every finish family's SkSL through CanvasKit (the same Skia the
 * web viewer uses) so shader syntax errors are caught in CI, not on a phone.
 */
import { beforeAll, describe, test, expect } from '@jest/globals'
import { SPECTRUM_SKSL } from '../spectrum.sksl'
import { GEOMETRIC_SKSL } from '../geometric.sksl'
import { FLUID_SKSL } from '../fluid.sksl'
import { METALLIC_SKSL } from '../metallic.sksl'
import { SPARKLE_SKSL } from '../sparkle.sksl'
import { WEAR_SKSL } from '../wear.sksl'
import { BEVEL_SKSL } from '../bevel.sksl'
import { FINISH_PRESETS, getPreset, makeFinish } from '../presets'
import { buildFinishUniforms, buildWearUniforms } from '../uniforms'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit.js')

const SOURCES: [string, string][] = [
  ['spectrum', SPECTRUM_SKSL],
  ['geometric', GEOMETRIC_SKSL],
  ['fluid', FLUID_SKSL],
  ['metallic', METALLIC_SKSL],
  ['sparkle', SPARKLE_SKSL],
  ['wear', WEAR_SKSL],
  ['bevel', BEVEL_SKSL],
]

describe('finish shaders', () => {
  let ck: any

  beforeAll(async () => {
    // jest-expo installs Expo's TextDecoder polyfill, which lacks the
    // utf-16le encoding CanvasKit needs; restore Node's implementation.
    const util = require('node:util')
    ;(globalThis as any).TextDecoder = util.TextDecoder
    ck = await CanvasKitInit()
  }, 60000)

  test.each(SOURCES)('%s SkSL compiles', (_name, source) => {
    let error = ''
    const effect = ck.RuntimeEffect.Make(source, (e: string) => {
      error = e
    })
    expect(error).toBe('')
    expect(effect).toBeTruthy()
    effect?.delete()
  })

  test('every preset resolves and builds a full uniform set', () => {
    for (const p of FINISH_PRESETS) {
      expect(getPreset(p.family, p.preset)).toBe(p)
      const finish = makeFinish(p.family, p.preset, {
        paletteMode: 'custom',
        customColors: ['#ff0000', '#00ff00'],
      })
      const u = buildFinishUniforms(finish, { tiltX: 0.3, tiltY: -0.2, lightX: 0.6, lightY: 0.3 }, { w: 750, h: 1050 })
      expect(u.uColors).toHaveLength(24)
      expect(u.uColorCount).toBe(2)
      for (const k of ['uP0', 'uP1', 'uP2', 'uP3'] as const) {
        expect(typeof u[k]).toBe('number')
      }
    }
  })

  test('wear uniforms cover every condition preset', () => {
    for (const preset of ['mint', 'near-mint', 'played', 'heavily-played'] as const) {
      const u = buildWearUniforms(
        { preset, intensity: 0.8 },
        { tiltX: 0.3, tiltY: -0.2, lightX: 0.6, lightY: 0.3 },
        { w: 750, h: 1050 },
      )
      expect(u.uAmount).toBe(0.8)
      expect(typeof u.uScratches).toBe('number')
    }
  })
})
