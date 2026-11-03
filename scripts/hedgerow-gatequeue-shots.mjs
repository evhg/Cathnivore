// Plan item 72: the round's threat staged before Go. Shoots levels 1, 12 and 40 between rounds (at the level's
// start, and with round 1 done) at P and D in 2D and 3D, and prints the gate queue the field drew.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/gate72 node scripts/hedgerow-gatequeue-shots.mjs   (MODES=2d SIZES=P LEVELS=40)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/gate72'
const sizes = process.env.SIZES ? process.env.SIZES.split(',') : ['P', 'D']
const modes = process.env.MODES ? process.env.MODES.split(',') : ['2d', '3d']
const levels = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : [1, 12, 40]
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const mode of modes)
  for (const size of sizes)
    for (const level of levels) {
      const [w, h] = SIZES[size]
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size !== 'D', isMobile: size !== 'D' })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => console.log('pageerror', String(e)))
      const url = `${base}?sandbox=1${mode === '2d' ? '&2d' : ''}`
      await page.goto(url)
      await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
      await page.goto(`${url}&level=${level}`)
      await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
      await page.waitForTimeout(mode === '2d' ? 900 : 5000)
      await page.screenshot({ path: `${out}/gate-${mode}-${size}-l${level}.png` })
      console.log(`${mode} ${size} l${level}`, JSON.stringify(await page.evaluate(() => window.hedgerow.gateQueue())))
      await ctx.close()
    }
await browser.close()
