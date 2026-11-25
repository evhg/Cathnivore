// Plan item 688: Hedgerow's 2D field at l27 (Saltmarsh) and l34, P and D.
//   npm run build:site && npx vite preview --outDir dist-site --port 4188 &  then  node scripts/hedgerow-688-shots.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'before'
const out = process.env.OUT ?? 'e2e/screenshots/h688'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, D: { viewport: { width: 1440, height: 900 } } }
for (const [s, opt] of Object.entries(SIZES)) for (const lv of (process.env.LEVELS ?? '27,34').split(',')) {
  const ctx = await b.newContext({ ...opt, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.addInitScript((lv) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { [lv]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true } })), lv)
  await p.goto(`http://localhost:4188/hedgerow/?sandbox=1&level=${lv}&2d`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${out}/${tag}-l${lv}-${s}.png` })
  await ctx.close()
}
await b.close()
