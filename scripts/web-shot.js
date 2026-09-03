/* Screenshot the web share viewer with headless Edge (verification aid).
   Usage: node scripts/web-shot.js [path] [outfile] */
const puppeteer = require('puppeteer-core')

const path = process.argv[2] ?? '/c/demo'
const out = process.argv[3] ?? 'scripts/web-shot.png'

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--window-size=480,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 480, height: 900 })
  page.on('console', (m) => console.log(`[page ${m.type()}]`, m.text().slice(0, 300)))
  page.on('pageerror', (e) => console.log('[pageerror]', (e.stack ?? String(e)).slice(0, 1200)))
  await page.goto(`${process.env.BASE_URL ?? 'http://localhost:8081'}${path}`, { waitUntil: 'networkidle2', timeout: 120000 })
  // give CanvasKit + fonts + first paint a moment
  await new Promise((r) => setTimeout(r, 6000))
  // wiggle the mouse so the tilt engine gets input
  await page.mouse.move(360, 300)
  await new Promise((r) => setTimeout(r, 800))
  // FLIP=1: tap the card to show its back before shooting
  if (process.env.FLIP) {
    await page.mouse.click(240, 420)
    await new Promise((r) => setTimeout(r, 1500))
  }
  const diag = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')]
    return {
      canvasKit: typeof window.CanvasKit !== 'undefined',
      canvases: canvases.map((c) => ({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight })),
    }
  })
  console.log('[diag]', JSON.stringify(diag))
  await page.screenshot({ path: out })
  await browser.close()
  console.log('wrote', out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
