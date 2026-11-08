// Plan item 278: the class pick's light key, measured. For each class at D (1440x900) it shoots
// `?front=classpick&shot&class=<id>` and reports the mean hue, saturation and value of the lit, coloured pixels on
// her figure box (the class's key light rimming her coat), and the closest pair of hues across classes.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-keylight.mjs
import { chromium } from '@playwright/test'

const base = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const classes = (process.env.CLASSES ?? 'ghost,butcher,gunslinger,wirewitch,fixer').split(',')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
const out = {}
for (const cls of classes) {
  const page = await ctx.newPage()
  await page.goto(`${base}?front=classpick&shot&t=8&quality=high&class=${cls}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 400_000 })
  await page.waitForTimeout(2500)
  const box = await page.evaluate(() => {
    const f = window.cathodeFront?.scene?.()?.figureBox?.()
    const sheet = document.querySelector('.cp-sheet')?.getBoundingClientRect()
    return f && { l: Math.max(0, f.left), t: Math.max(0, f.top), r: Math.min(sheet ? sheet.left : 1440, f.right), b: Math.min(900, f.bottom) }
  })
  const png = (await page.screenshot({ timeout: 300_000 })).toString('base64')
  const m = await page.evaluate(async ({ png, box }) => {
    const img = new Image()
    img.src = `data:image/png;base64,${png}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const w = Math.round(box.r - box.l)
    const h = Math.round(box.b - box.t)
    const d = g.getImageData(Math.round(box.l), Math.round(box.t), w, h).data
    let x = 0, y = 0, n = 0
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b)
      if (mx < 0.2 || mx - mn < 0.2 * mx) continue
      let hue = mx === r ? (gg - b) / (mx - mn) : mx === gg ? 2 + (b - r) / (mx - mn) : 4 + (r - gg) / (mx - mn)
      hue = (hue * 60 + 360) % 360
      x += Math.cos((hue * Math.PI) / 180)
      y += Math.sin((hue * Math.PI) / 180)
      n++
    }
    return { hue: Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360), coherence: +(Math.hypot(x, y) / n).toFixed(2), share: +(n / (w * h)).toFixed(3) }
  }, { png, box })
  out[cls] = m
  console.log(cls, JSON.stringify(m))
  await page.close()
}
let min = 999, pair = ''
for (const a of classes) for (const b of classes) if (a < b) {
  const d = Math.abs(out[a].hue - out[b].hue)
  const dd = Math.min(d, 360 - d)
  if (dd < min) { min = dd; pair = `${a}/${b}` }
}
console.log(`closest pair ${pair}: ${min} deg`)
await browser.close()
