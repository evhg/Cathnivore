// Plan item 43: Hedgerow's landmarks. Shoots levels 1, 5, 12, 21, 38, 45 and the boss fields at P, D and L, in 2D
// (`?2d`) and 3D, in `?sandbox=1` with nothing built, so the field itself shows.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/hedgerow-landmarks node scripts/hedgerow-landmark-shots.mjs
// LEVELS=1,5 SIZES=P,D MODES=2d,3d narrow it. Set PLAYWRIGHT_CHROMIUM_PATH if the pinned Chromium is missing.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/hedgerow-landmarks'
const levels = (process.env.LEVELS ?? '1,5,10,12,20,21,38,45,50,100').split(',').map(Number)
const sizes = (process.env.SIZES ?? 'P,D,L').split(',')
const modes = (process.env.MODES ?? '2d,3d').split(',')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], L: [844, 390], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const mode of modes)
  for (const size of sizes)
    for (const level of levels) {
      const [w, h] = SIZES[size]
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size !== 'D', isMobile: size !== 'D' })
      const page = await ctx.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      const url = `${base}?sandbox=1${mode === '2d' ? '&2d' : ''}`
      await page.goto(url)
      await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
      await page.goto(`${url}&level=${level}`)
      await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
      await page.waitForTimeout(mode === '2d' ? 800 : 6000)
      await page.screenshot({ path: `${out}/${mode}-${size}-L${level}.png` })
      if (errors.length) console.log(mode, size, level, errors.slice(0, 2))
      await ctx.close()
    }
await browser.close()
console.log('done', out)
