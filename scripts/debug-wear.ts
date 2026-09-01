import * as fs from 'node:fs'
import { WEAR_SKSL } from '../src/finishes/wear.sksl'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit.js')

async function main() {
  ;(globalThis as any).TextDecoder = require('node:util').TextDecoder
  const ck = await CanvasKitInit()
  const W = 300
  const H = 420
  const surface = ck.MakeSurface(W, H)
  const canvas = surface.getCanvas()
  let err = ''
  const effect = ck.RuntimeEffect.Make(WEAR_SKSL, (e: string) => (err = e))
  if (!effect) throw new Error(err)
  // uSize uTilt uLight uAmount uScratches uEdge uCorner uSeed
  const flat = [W, H, 1, 0, 0.95, 0.35, 1.0, 8.0, 0.0, 0.0, 7.31]
  const shader = effect.makeShader(flat)
  const paint = new ck.Paint()
  paint.setShader(shader)
  canvas.clear(ck.Color(24, 32, 58, 1))
  canvas.drawRect(ck.XYWHRect(0, 0, W, H), paint)
  surface.flush()
  const img = surface.makeImageSnapshot()
  fs.writeFileSync('scripts/debug-wear.png', Buffer.from(img.encodeToBytes()))
  console.log('wrote scripts/debug-wear.png (scratches x8, edges/corners off)')
}
main()
