// Plan item 59: the growing field. Levels 1, 13 and 38 at round 1, mid-level, the last round and the win's
// harvest, at P and D, in 2D and 3D (`?sandbox=1`; rounds are set on the game directly).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/growth59 node scripts/hedgerow-growth-shots.mjs   (MODES=2d SIZES=P LEVELS=13)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/growth59'
const sizes = process.env.SIZES ? process.env.SIZES.split(',') : ['P', 'D']
const modes = process.env.MODES ? process.env.MODES.split(',') : ['2d', '3d']
const levels = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : [1, 13, 38]
const moments = process.env.MOMENTS ? process.env.MOMENTS.split(',') : ['r1', 'mid', 'last', 'win']
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
      await page.waitForTimeout(mode === '2d' ? 600 : 4000)
      for (const m of moments) {
        await page.evaluate((m) => {
          const g = window.hedgerow.game()
          const n = g.level.waves.length
          if (m === 'r1') g.paid = 0
          if (m === 'mid') g.paid = Math.floor(n / 2)
          if (m === 'last') g.paid = n - 1
          if (m === 'win') { g.paid = n; g.phase = 'won' }
          window.hedgerow.refresh?.()
        }, m)
        await page.waitForTimeout(m === 'win' ? (mode === '2d' ? 700 : 900) : mode === '2d' ? 700 : 2500)
        const ripe = await page.evaluate(() => document.querySelector('[data-ripe]')?.getAttribute('data-ripe'))
        const file = `${out}/growth-${mode}-${size}-l${level}-${m}.png`
        await page.screenshot({ path: file })
        console.log(file, 'ripe', ripe)
      }
      await ctx.close()
    }
await browser.close()
