/* eslint-disable no-console */
// Generate app icons with the real finish shaders (run: npx tsx scripts/render-icon.ts).
// Outputs: assets/icon.png (1024, opaque, iOS), android adaptive foreground/
// background/monochrome. Design: a tilted holo card on a deep navy ground.

import * as fs from 'node:fs'
import * as path from 'node:path'
import { makeFinish } from '../src/finishes/presets'
import { buildFinishUniforms } from '../src/finishes/uniforms'
import { lightFromTilt } from '../src/model/types'
import { SPECTRUM_SKSL } from '../src/finishes/spectrum.sksl'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit.js')

const SIZE = 1024
const BG = '#0b0e19'

function flat(u: Record<string, number | number[]>): number[] {
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
  const ck = await CanvasKitInit()
  const outDir = path.join(__dirname, '..', 'assets')

  const effect = ck.RuntimeEffect.Make(SPECTRUM_SKSL, (err: string) => {
    throw new Error(err)
  })
  const finish = makeFinish('spectrum', 'refractor', { intensity: 0.95 })
  finish.params.p0 = 7 // few, bold refractor lines — legible at icon size
  finish.params.p3 = 1.1 // broad hue bands
  const tiltX = 0.45
  const tiltY = -0.25

  const drawCard = (
    canvas: any,
    opts: { withShine: boolean; color?: string },
  ) => {
    const cw = 560
    const chh = 780
    canvas.save()
    canvas.translate(SIZE / 2, SIZE / 2)
    canvas.rotate(-8, 0, 0)
    const rect = ck.RRectXY(ck.XYWHRect(-cw / 2, -chh / 2, cw, chh), 56, 56)
    const paint = new ck.Paint()
    paint.setAntiAlias(true)
    if (opts.withShine) {
      const u = buildFinishUniforms(
        finish,
        { tiltX, tiltY, ...lightFromTilt(tiltX, tiltY) },
        { w: cw, h: chh },
      )
      // shader samples canvas coords; offset so the pattern is centered
      canvas.save()
      canvas.clipRRect(rect, ck.ClipOp.Intersect, true)
      canvas.translate(-cw / 2, -chh / 2)
      paint.setShader(effect.makeShader(flat(u)))
      canvas.drawRect(ck.XYWHRect(0, 0, cw, chh), paint)
      canvas.restore()
      // card edge
      const edge = new ck.Paint()
      edge.setAntiAlias(true)
      edge.setStyle(ck.PaintStyle.Stroke)
      edge.setStrokeWidth(18)
      edge.setColor(ck.parseColorString('#f4f2ec'))
      canvas.drawRRect(rect, edge)
      edge.delete()
    } else {
      paint.setColor(ck.parseColorString(opts.color ?? '#ffffff'))
      canvas.drawRRect(rect, paint)
    }
    paint.delete()
    canvas.restore()
  }

  const render = (draw: (canvas: any) => void): Buffer => {
    const surface = ck.MakeSurface(SIZE, SIZE)
    draw(surface.getCanvas())
    surface.flush()
    const img = surface.makeImageSnapshot()
    const bytes = img.encodeToBytes()
    img.delete()
    surface.delete()
    return Buffer.from(bytes)
  }

  // iOS icon: opaque bg + holo card
  fs.writeFileSync(
    path.join(outDir, 'icon.png'),
    render((c) => {
      c.clear(ck.parseColorString(BG))
      drawCard(c, { withShine: true })
    }),
  )

  // Android adaptive foreground: card only, transparent, inside safe zone
  fs.writeFileSync(
    path.join(outDir, 'android-icon-foreground.png'),
    render((c) => {
      c.clear(ck.TRANSPARENT)
      c.save()
      c.translate(SIZE / 2, SIZE / 2)
      c.scale(0.62, 0.62)
      c.translate(-SIZE / 2, -SIZE / 2)
      drawCard(c, { withShine: true })
      c.restore()
    }),
  )

  // Android adaptive background: solid ground
  fs.writeFileSync(
    path.join(outDir, 'android-icon-background.png'),
    render((c) => c.clear(ck.parseColorString(BG))),
  )

  // Android monochrome: white silhouette
  fs.writeFileSync(
    path.join(outDir, 'android-icon-monochrome.png'),
    render((c) => {
      c.clear(ck.TRANSPARENT)
      c.save()
      c.translate(SIZE / 2, SIZE / 2)
      c.scale(0.62, 0.62)
      c.translate(-SIZE / 2, -SIZE / 2)
      drawCard(c, { withShine: false, color: '#ffffff' })
      c.restore()
    }),
  )

  effect.delete()
  console.log('wrote icon.png + android adaptive icons to assets/')
}

main()
