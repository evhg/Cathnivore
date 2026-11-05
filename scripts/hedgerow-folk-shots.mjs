// Plan item 143: the farmfolk at P (390x844) and D (1440x900), 2D and 3D, in the build phase and running for the
// farmhouse after a leak. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/folk143 node scripts/hedgerow-folk-shots.mjs   (LEVELS=21,34 MODES=2d,3d SIZES=P,D)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/folk143'
const levels = (process.env.LEVELS ?? '21,34').split(',').map(Number)
const modes = (process.env.MODES ?? '2d,3d').split(',')
const sizes = (process.env.SIZES ?? 'P,D').split(',')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const level of levels)
  for (const mode of modes)
    for (const size of sizes) {
      const [w, h] = SIZES[size]
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.DSF ?? 1), hasTouch: size !== 'D', isMobile: size !== 'D' })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => console.log('pageerror', String(e)))
      const url = `${base}?sandbox=1${process.env.QUERY ?? ''}${mode === '2d' ? '&2d' : ''}`
      await page.goto(url)
      await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
      await page.goto(`${url}&level=${level}`)
      await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
      await page.waitForTimeout(mode === '2d' ? 2500 : 8000)
      const folk = await page.evaluate(() => window.hedgerow.folk())
      console.log(level, mode, size, JSON.stringify(folk.map((f) => [f.kind, f.x.toFixed(2), f.y.toFixed(2), f.mode])))
      await page.screenshot({ path: `${out}/l${level}-${mode}-${size}.png` })
      await page.evaluate(() => window.hedgerow.debrief('van'))
      await page.waitForTimeout(mode === '2d' ? 450 : 1500)
      await page.screenshot({ path: `${out}/l${level}-${mode}-${size}-flee.png` })
      await ctx.close()
    }
await browser.close()
