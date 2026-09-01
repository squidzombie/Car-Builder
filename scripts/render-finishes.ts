/**
 * §12 finish screenshots: renders every preset through CanvasKit (the same
 * Skia the web viewer uses) at tilts (0,0), (1,0), (0,1) and writes PNGs to
 * docs/finishes/. Run with: npm run finish-shots
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { FINISH_PRESETS, makeFinish } from '../src/finishes/presets'
import { buildFinishUniforms, buildWearUniforms } from '../src/finishes/uniforms'
import { lightFromTilt, type ConditionPreset } from '../src/model/types'
import { WEAR_SKSL } from '../src/finishes/wear.sksl'
import { SPECTRUM_SKSL } from '../src/finishes/spectrum.sksl'
import { GEOMETRIC_SKSL } from '../src/finishes/geometric.sksl'
import { FLUID_SKSL } from '../src/finishes/fluid.sksl'
import { METALLIC_SKSL } from '../src/finishes/metallic.sksl'
import { SPARKLE_SKSL } from '../src/finishes/sparkle.sksl'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit.js')

const SOURCES: Record<string, string> = {
  spectrum: SPECTRUM_SKSL,
  geometric: GEOMETRIC_SKSL,
  fluid: FLUID_SKSL,
  metallic: METALLIC_SKSL,
  sparkle: SPARKLE_SKSL,
}

const W = 300
const H = 420
const TILTS: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
]

/** Flatten to the declaration order of the shared uniform block (common.sksl.ts). */
function flatten(u: Record<string, number | number[]>): number[] {
  return [
    ...(u.uSize as number[]),
    ...(u.uTilt as number[]),
    ...(u.uLight as number[]),
    u.uIntensity as number,
    u.uScale as number,
    u.uColorCount as number,
    ...(u.uColors as number[]),
    u.uP0 as number,
    u.uP1 as number,
    u.uP2 as number,
    u.uP3 as number,
    u.uMode as number,
  ]
}

async function main() {
  // Node's TextDecoder (CanvasKit needs utf-16le, which some polyfills lack)
  ;(globalThis as any).TextDecoder = require('node:util').TextDecoder
  const ck = await CanvasKitInit()
  const outDir = path.join(__dirname, '..', 'docs', 'finishes')
  fs.mkdirSync(outDir, { recursive: true })

  const surface = ck.MakeSurface(W, H)
  if (!surface) throw new Error('MakeSurface failed')
  const canvas = surface.getCanvas()
  let count = 0

  for (const p of FINISH_PRESETS) {
    let err = ''
    const effect = ck.RuntimeEffect.Make(SOURCES[p.family], (e: string) => {
      err = e
    })
    if (!effect) throw new Error(`${p.family} SkSL failed to compile: ${err}`)

    for (const [tx, ty] of TILTS) {
      const finish = makeFinish(p.family, p.preset)
      const uniforms = buildFinishUniforms(
        finish,
        { tiltX: tx, tiltY: ty, ...lightFromTilt(tx, ty) },
        { w: W, h: H },
      )
      const shader = effect.makeShader(flatten(uniforms))
      const paint = new ck.Paint()
      paint.setShader(shader)
      canvas.clear(ck.Color(12, 13, 18, 1))
      canvas.drawRect(ck.XYWHRect(0, 0, W, H), paint)
      surface.flush()
      const img = surface.makeImageSnapshot()
      const bytes = img.encodeToBytes()
      if (!bytes) throw new Error('encodeToBytes failed')
      const file = path.join(outDir, `${p.family}-${p.preset}_${tx}_${ty}.png`)
      fs.writeFileSync(file, Buffer.from(bytes))
      count++
      img.delete()
      paint.delete()
      shader.delete()
    }
    effect.delete()
  }

  // wear overlay (Build 4): each condition preset over a dark ground
  let wearErr = ''
  const wearEffect = ck.RuntimeEffect.Make(WEAR_SKSL, (e: string) => {
    wearErr = e
  })
  if (!wearEffect) throw new Error(`wear SkSL failed to compile: ${wearErr}`)
  const wearPresets: ConditionPreset[] = ['mint', 'near-mint', 'played', 'heavily-played']
  for (const preset of wearPresets) {
    for (const [tx, ty] of TILTS) {
      const u = buildWearUniforms(
        { preset, intensity: 1 },
        { tiltX: tx, tiltY: ty, ...lightFromTilt(tx, ty) },
        { w: W, h: H },
      )
      const flat = [
        ...(u.uSize as number[]),
        ...(u.uTilt as number[]),
        ...(u.uLight as number[]),
        u.uAmount as number,
        u.uScratches as number,
        u.uEdge as number,
        u.uCorner as number,
        u.uSeed as number,
      ]
      const shader = wearEffect.makeShader(flat)
      const paint = new ck.Paint()
      paint.setShader(shader)
      canvas.clear(ck.Color(24, 32, 58, 1))
      canvas.drawRect(ck.XYWHRect(0, 0, W, H), paint)
      surface.flush()
      const img = surface.makeImageSnapshot()
      const bytes = img.encodeToBytes()
      if (!bytes) throw new Error('encodeToBytes failed')
      fs.writeFileSync(
        path.join(outDir, `wear-${preset}_${tx}_${ty}.png`),
        Buffer.from(bytes),
      )
      count++
      img.delete()
      paint.delete()
      shader.delete()
    }
  }
  wearEffect.delete()
  console.log(`wrote ${count} screenshots to docs/finishes/`)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
