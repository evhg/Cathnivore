// Plan item 95: the round card as a threat poster and Cath's advice on the field, shot at P and D in 2D and 3D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4190 &
//        node scripts/hedgerow-95-shots.mjs <outdir> [levels...]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4190'
const out = process.argv[2] ?? 'e2e/screenshots/h95'
const levels = process.argv.slice(3).map(Number)
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, D: { viewport: { width: 1440, height: 900 } } }
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [s, opts] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.goto(`${base}/hedgerow/?2d`)
  await p.evaluate(() => {
    const stars = {}
    for (let i = 1; i <= 40; i++) stars[i] = 3
    const seen = {}
    for (let i = 1; i <= 40; i++) seen[i] = true
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: seen, tips: { move: true, early: true, build: true } }))
  })
  for (const lv of levels.length ? levels : [21, 12, 3]) {
    for (const mode of ['2d', '3d']) {
      await p.goto(`${base}/hedgerow/?sandbox=1&level=${lv}${mode === '2d' ? '&2d' : ''}`)
      await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
      await p.waitForTimeout(mode === '2d' ? 1500 : 6000)
      await p.screenshot({ path: `${out}/l${lv}-${mode}-${s}.png` })
    }
  }
  await ctx.close()
}
await browser.close()
