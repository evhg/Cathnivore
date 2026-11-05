// Plan item 140: shoots the NIGHT SHIFT title at D and P and measures her face (height, brightest pixel, mean
// luminance, rose-hue pixels). Needs a dist-site preview on :4190. Usage: node scripts/cathode-face-measure.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] || 'x'
const out = 'e2e/screenshots/face140'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['D', { width: 1440, height: 900 }], ['P', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp })
  await p.goto('http://localhost:4190/nightshift/?shot')
  await p.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto('http://localhost:4190/nightshift/?front=title&shot&t=8&quality=phone')
  await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 200000 })
  await p.waitForTimeout(3000)
  const f = await p.evaluate(() => window.cathodeFront.scene().faceBox())
  await p.screenshot({ path: `${out}/${tag}-${n}.png` })
  const clip = { x: Math.max(0, f.left - 10), y: Math.max(0, f.top - 10), width: f.right - f.left + 20, height: f.bottom - f.top + 20 }
  const buf = await p.screenshot({ clip })
  await p.screenshot({ path: `${out}/${tag}-${n}-face.png`, clip })
  const m = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let maxL = 0, rose = 0, mean = 0
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, gg = d[i + 1] / 255, bb = d[i + 2] / 255
      const L = 0.2126 * r + 0.7152 * gg + 0.0722 * bb
      mean += L; if (L > maxL) maxL = L
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb)
      if (mx - mn > 0.15 && r === mx) { let h = (gg - bb) / (mx - mn) * 60; if (h < 0) h += 360; if ((h >= 330 || h <= 15) && mx > 0.35) rose++ }
    }
    return { maxL: +maxL.toFixed(2), mean: +(mean / (d.length / 4)).toFixed(3), rose }
  }, buf.toString('base64'))
  console.log(n, JSON.stringify({ h: Math.round(f.bottom - f.top), ...m }))
  await p.close()
}
await b.close()
