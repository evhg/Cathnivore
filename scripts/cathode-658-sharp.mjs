// Plan item 658: NIGHT SHIFT's first street frame at D for each render scale given (default 0.5 and 1), with the
// Laplacian variance (sharpness) of the frame's middle third. CATHODE_URL=... node scripts/cathode-658-sharp.mjs <tag> [rs...]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const [tag = 'x', ...scales] = process.argv.slice(2)
const out = process.env.OUT ?? 'e2e/screenshots/ns658'
mkdirSync(out, { recursive: true })
const url = process.env.CATHODE_URL ?? 'http://localhost:4175/nightshift/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const rs of scales.length ? scales : ['0.5', '1']) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto(`${url}?play&class=ghost&rs=${rs}`)
  await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) >= 3, null, { timeout: 240000 }).catch(() => {})
  await p.waitForTimeout(4000)
  const file = `${out}/${tag}-rs${rs}-D.png`
  await p.screenshot({ path: file })
  const v = await p.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const w = img.width, h = img.height, y0 = Math.floor(h / 3), y1 = Math.floor(2 * h / 3)
    const d = x.getImageData(0, y0, w, y1 - y0).data, H = y1 - y0
    const L = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    let s = 0, s2 = 0, n = 0
    for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
      const i = (yy * w + xx) * 4
      const lap = 4 * L(i) - L(i - 4) - L(i + 4) - L(i - w * 4) - L(i + w * 4)
      s += lap; s2 += lap * lap; n++
    }
    return s2 / n - (s / n) ** 2
  }, 'data:image/png;base64,' + (await p.screenshot()).toString('base64'))
  console.log(`rs ${rs}: middle-third Laplacian variance ${v.toFixed(1)} (${file})`)
  await p.close()
}
await b.close()
