// Plan item 469: a stable 3D key-art frame per act. Each act's first level under `?keyart` (no HUD) in 3D: waits for
// `data-keyart-still` (the world's clock stands still once the camera settles), shoots twice 1.5 s apart and reports
// the share of pixels that differ (stable means under 0.5%).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4190 &
//        OUT=e2e/screenshots/keyart3d node scripts/hedgerow-keyart3d-shots.mjs   (ACTS=1,3 for a few)
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4190'
const out = process.env.OUT ?? 'e2e/screenshots/keyart3d'
const acts = (process.env.ACTS ?? '1,2,3,4,5,6,7,8,9,10').split(',').map(Number)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
await p.goto(`${base}/hedgerow/?2d`)
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
const stars = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i + 1), 3]))
const seen = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i + 1), true]))
await p.evaluate(([s, t, v]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: v, tips: t })), [stars, tips, seen])
let worst = 0
for (const act of acts) {
  const level = (act - 1) * 10 + 1
  await p.goto(`${base}/hedgerow/?keyart&sandbox=1&level=${level}`)
  await p.waitForFunction(() => document.documentElement.hasAttribute('data-keyart-still'), null, { timeout: 90000 })
  await p.waitForTimeout(800)
  const a = `${out}/act${act}-l${level}.png`
  await p.screenshot({ path: a })
  await p.waitForTimeout(1500)
  const b = `${out}/act${act}-l${level}-again.png`
  await p.screenshot({ path: b })
  const diff = await p.evaluate(async ([x, y]) => {
    const load = async (d) => { const i = new Image(); i.src = d; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height).data }
    const [p1, p2] = [await load(x), await load(y)]
    let n = 0
    for (let k = 0; k < p1.length; k += 4) if (Math.abs(p1[k] - p2[k]) + Math.abs(p1[k + 1] - p2[k + 1]) + Math.abs(p1[k + 2] - p2[k + 2]) > 24) n++
    return n / (p1.length / 4)
  }, [a, b].map((f) => 'data:image/png;base64,' + readFileSync(f).toString('base64')))
  worst = Math.max(worst, diff)
  console.log(`act ${act} (level ${level}): ${(diff * 100).toFixed(2)}% of pixels differ between two shots`)
}
await browser.close()
if (worst > 0.005) { console.log('not stable'); process.exitCode = 1 }
