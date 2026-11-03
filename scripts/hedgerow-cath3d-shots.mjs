// Plan item 52: Cath's modelled figure in 3D, zoomed in on her (2.6x) and at the field's normal framing, at P and D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/field52 node scripts/hedgerow-cath3d-shots.mjs   (SIZES=P,D LEVEL=13)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/field52'
const level = Number(process.env.LEVEL ?? 13)
const sizes = (process.env.SIZES ?? 'P,D').split(',')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], L: [844, 390], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const size of sizes) {
  const [w, h] = SIZES[size]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size !== 'D', isMobile: size !== 'D' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${base}?sandbox=1`)
  await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
  await page.goto(`${base}?sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game() && !!window.hedgerow3d, null, { timeout: 90000 })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: `${out}/cath3d-${size}-L${level}.png` })
  await page.evaluate(() => {
    const r = window.hedgerow3d
    const g = window.hedgerow.game()
    r.zoomBy(2.6)
    r.pan.set(g.hero.x - g.level.cols / 2, g.hero.y - g.level.rows / 2 - 0.4)
    r.clampPan()
  })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `${out}/cath3d-zoom-${size}-L${level}.png` })
  if (errors.length) console.log(size, errors.slice(0, 2))
  await ctx.close()
}
await browser.close()
