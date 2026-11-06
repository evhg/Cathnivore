// Plan item 179: the 3D (and ?2d) depot at levels 21 and 34, P and D, with what depots3d() and gateQueue() report.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//        PLAYWRIGHT_CHROMIUM_PATH=... OUT=e2e/screenshots/h179 node scripts/hedgerow-depot-shots.mjs  (SIZES=P,D LEVELS=21,34 MODES=3d,2d SEND=1)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = 'http://localhost:4186/hedgerow/'
const out = process.env.OUT
const sizes = (process.env.SIZES ?? 'P,D').split(',')
const levels = (process.env.LEVELS ?? '21,34').split(',').map(Number)
const modes = (process.env.MODES ?? '3d').split(',')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const SZ = { P: [390, 844], D: [1440, 900], L: [844, 390] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const mode of modes) for (const size of sizes) for (const level of levels) {
  const [w, h] = SZ[size]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size !== 'D', isMobile: size !== 'D' && !process.env.NOMOBILE })
  const page = await ctx.newPage()
  page.on('console', (m) => m.text().startsWith('DEPOT') && console.log(m.text())); page.on('pageerror', (e) => console.log('pageerror', String(e)))
  const url = `${base}?sandbox=1${mode === '2d' ? '&2d' : ''}`
  await page.goto(url)
  await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
  await page.goto(`${url}&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await page.waitForTimeout(mode === '2d' ? 1200 : 9000)
  await page.screenshot({ path: `${out}/${mode}-${size}-l${level}.png` })
  console.log(mode, size, level, JSON.stringify(await page.evaluate(() => ({ d: window.hedgerow.depots3d?.(), q: window.hedgerow.gateQueue?.(), say: window.hedgerow.cathSay?.()?.box, dom: [...document.querySelectorAll('[data-depot]')].length }))))
  if (process.env.SEND) { await page.evaluate(() => window.hedgerow.sendWave(window.hedgerow.game())); await page.waitForTimeout(mode === '2d' ? 400 : 2500); await page.screenshot({ path: `${out}/${mode}-${size}-l${level}-go.png` }) }
  await ctx.close()
}
await browser.close()
