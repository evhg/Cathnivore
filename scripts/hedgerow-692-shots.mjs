// Plan item 692: Hedgerow's play panel (2D) at D and P on levels 27 and 34.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/h692 TAG=after node scripts/hedgerow-692-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'e2e/screenshots/h692'
const tag = process.env.TAG ?? 'after'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, D: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } }
for (const lv of [27, 34]) for (const [s, opts] of Object.entries(SIZES)) {
  const p = await b.newPage(opts)
  await p.addInitScript(() => {
    try { localStorage.setItem('hedgerow:v1', JSON.stringify({ seenBefore: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [i + 1, true])) })) } catch {}
  })
  await p.goto(`${base}/hedgerow/?2d&sandbox=1&level=${lv}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60_000 })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${tag}-l${lv}-${s}.png` })
  if (s === 'D') await p.locator('.play .panel').first().screenshot({ path: `${out}/${tag}-panel-l${lv}-D.png`, timeout: 5000 }).catch((e) => console.log(e.message))
  await p.close()
}
await b.close()
