// Plan item 755: how much of the case briefing is dead black. Shoots the held briefing at P and D and reports the
// share of pixels under 0.08 luma and the darkest 200x200 window's mean luma (0..1, gamma-encoded pixels).
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &   then node scripts/cathode-755-measure.mjs
import { chromium } from '@playwright/test'
const base = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [vp, w, h] of [['P', 390, 844], ['D', 1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  const p = await ctx.newPage()
  await p.goto(`${base}?front=loading&shot`)
  await p.locator('#loading:not([hidden]) .ld-name').waitFor({ timeout: 120_000 })
  await p.waitForTimeout(2500)
  const png = (await p.screenshot()).toString('base64')
  const r = await p.evaluate(async (src) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const W = c.width, H = c.height
    const Y = new Float32Array(W * H)
    let dark = 0
    for (let i = 0; i < W * H; i++) {
      Y[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255
      if (Y[i] < 0.08) dark++
    }
    let best = [9, 0, 0]
    const n = Math.min(200, W)
    for (let y = 0; y + n <= H; y += 20)
      for (let x = 0; x + n <= W; x += 20) {
        let s = 0
        for (let yy = y; yy < y + n; yy += 2) for (let xx = x; xx < x + n; xx += 2) s += Y[yy * W + xx]
        const m = s / ((n / 2) * (n / 2))
        if (m < best[0]) best = [m, x, y]
      }
    return { dark: dark / (W * H), min: best }
  }, png)
  console.log(vp, `dark share ${r.dark.toFixed(2)}`, `darkest ${200}px window ${r.min[0].toFixed(3)} at ${r.min[1]},${r.min[2]}`)
  await ctx.close()
}
await b.close()
