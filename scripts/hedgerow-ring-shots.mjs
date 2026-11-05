// Plan item 156: the build ring round a tapped plot at P (390x844) and D (1440x900), 2D and 3D: a middle plot, a
// corner plot, a packet previewed, and with no Marks. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/ring156 node scripts/hedgerow-ring-shots.mjs   (LEVELS=21 MODES=2d,3d SIZES=P,D)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/ring156'
const levels = (process.env.LEVELS ?? '21').split(',').map(Number)
const modes = (process.env.MODES ?? '2d,3d').split(',')
const sizes = (process.env.SIZES ?? 'P,D').split(',')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], D: [1440, 900], L: [844, 390] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
const pick = (page) =>
  page.evaluate(() => {
    const all = window.hedgerow.plotBoxes().filter((b) => document.elementFromPoint(b.x + b.w / 2, b.y + b.h / 2)?.id === 'canvas')
    const by = (f) => all.reduce((m, b) => (f(b) < f(m) ? b : m))
    const cx = innerWidth / 2, cy = innerHeight / 2
    return { mid: by((b) => Math.hypot(b.x - cx, b.y - cy)), corner: by((b) => b.x + b.y), low: by((b) => b.x - b.y) }
  })
for (const level of levels)
  for (const mode of modes)
    for (const size of sizes) {
      const [w, h] = SIZES[size]
      const touch = size !== 'D'
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.DSF ?? 1), hasTouch: touch, isMobile: touch })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => console.log('pageerror', String(e)))
      const url = `${base}?sandbox=1${process.env.QUERY ?? ''}${mode === '2d' ? '&2d' : ''}`
      await page.goto(url)
      await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
      await page.goto(`${url}&level=${level}`)
      await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
      await page.waitForTimeout(mode === '2d' ? 2000 : 8000)
      const wait = mode === '2d' ? 400 : 1500
      const at = await pick(page)
      const tap = async (b) => (touch ? page.touchscreen.tap(b.x + b.w / 2, b.y + b.h / 2) : page.mouse.click(b.x + b.w / 2, b.y + b.h / 2))
      await page.screenshot({ path: `${out}/l${level}-${mode}-${size}-before.png` })
      for (const k of ['mid', 'corner', 'low']) {
        await page.keyboard.press('Escape')
        await tap(at[k])
        await page.waitForTimeout(wait)
        await page.screenshot({ path: `${out}/l${level}-${mode}-${size}-${k}.png` })
      }
      await page.keyboard.press('Escape')
      await tap(at.mid)
      await page.waitForTimeout(wait)
      const p = page.locator('.ring-packet').nth(2)
      if (touch) await p.tap()
      else await p.hover()
      await page.waitForTimeout(wait)
      await page.screenshot({ path: `${out}/l${level}-${mode}-${size}-preview.png` })
      await page.evaluate(() => (window.hedgerow.game().marks = 150))
      await page.waitForTimeout(wait)
      await page.screenshot({ path: `${out}/l${level}-${mode}-${size}-poor.png` })
      await ctx.close()
    }
await browser.close()
