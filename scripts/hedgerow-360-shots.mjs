// Plan item 360: Hedgerow 3D levels 21 and 34 at P (390x844) and D (1440x900), for the farmland and light pass.
// Usage: npx tsx scripts/build-site.ts --only=hedgerow && npx vite preview --outDir dist-site --port 4180 &
//        OUT=<dir> TAG=before node scripts/hedgerow-360-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/h360'
const tag = process.env.TAG ?? 'shot'
const levels = (process.env.LEVELS ?? '21,34').split(',').map(Number)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: [390, 844], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const level of levels) {
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size === 'P', isMobile: size === 'P' })
    const page = await ctx.newPage()
    const url = `${base}?sandbox=1`
    await page.goto(url)
    await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
    await page.goto(`${url}&level=${level}`)
    await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
    await page.waitForTimeout(9000)
    await page.screenshot({ path: `${out}/${tag}-l${level}-${size}.png`, timeout: 120000 })
    await ctx.close()
    console.log('shot', level, size)
  }
}
await browser.close()
