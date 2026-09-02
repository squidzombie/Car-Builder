// Render the shaped border frames' paths to PNGs (geometry check for
// hand-written frame shapes). Usage: npx tsx scripts/check-frames.ts
import * as fs from 'fs'
import * as path from 'path'
import { BORDER_PRESETS } from '../src/presets/elements'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit.js')

const W = 300
const H = 420

async function main() {
  const ck = await CanvasKitInit()
  const outDir = path.join(__dirname, '..', 'docs', 'borders')
  fs.mkdirSync(outDir, { recursive: true })

  for (const preset of BORDER_PRESETS) {
    const built = preset.build()
    const shape = built.shapes?.[0]
    if (!shape) continue
    const surface = ck.MakeSurface(W, H)!
    const canvas = surface.getCanvas()
    canvas.clear(ck.Color(20, 26, 40, 1))
    const p = ck.Path.MakeFromSVGString(shape.path)!
    if (shape.fillRule === 'evenodd') p.setFillType(ck.FillType.EvenOdd)
    const paint = new ck.Paint()
    paint.setColor(ck.Color(244, 242, 236, 1))
    paint.setAntiAlias(true)
    canvas.save()
    canvas.scale(W, H)
    canvas.drawPath(p, paint)
    canvas.restore()
    const img = surface.makeImageSnapshot()
    const png = img.encodeToBytes()!
    fs.writeFileSync(path.join(outDir, `${preset.id}.png`), Buffer.from(png))
    console.log(`wrote ${preset.id}.png`)
  }
}

main()
