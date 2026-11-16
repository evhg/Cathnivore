// Plan item 442: the shared 2D Cath on the screens that carry her, at P (390x844) and D (1440x900):
// Cathnivore's title, campaign map and Quick Game setup, the portfolio, /games/ and Runnel.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//   OUT=e2e/screenshots/<tag> node scripts/cath-screens-shots.mjs   (BASE=http://localhost:4186)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:4186'
const out = process.env.OUT ?? 'e2e/screenshots/cath-screens'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const screens = [
  ['cath-title', '/cathnivore/', null],
  ['cath-campaign', '/cathnivore/', 'Campaign'],
  ['cath-setup', '/cathnivore/', 'Quick Game'],
  ['portfolio', '/', null],
  ['games', '/games/', null],
  ['runnel', '/runnel/', null],
]
for (const [size, w, h] of [['P', 390, 844], ['D', 1440, 900]])
  for (const [name, path, click] of screens) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: size === 'P', reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(base + path)
    await p.waitForLoadState('networkidle').catch(() => {})
    if (click) await p.getByText(click, { exact: false }).first().click().catch((e) => console.log(name, size, 'no click', String(e).slice(0, 80)))
    await p.waitForTimeout(1500)
    await p.screenshot({ path: `${out}/${name}-${size}.png` })
    await ctx.close()
  }
await b.close()
