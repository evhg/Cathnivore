// Plan item 208: Cath's 3D figure at the default camera, clipped round her at 3x, at P and D, for before/after.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=<dir> LEVEL=21 node scripts/hedgerow-cath-closeup.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/cath-closeup'
const level = Number(process.env.LEVEL ?? 21)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], D: [1440, 900] }
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const size of ['P', 'D']) {
  const [w, h] = SIZES[size]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, hasTouch: size !== 'D', isMobile: size !== 'D' })
  const page = await ctx.newPage()
  await page.goto(`${base}?sandbox=1`)
  await page.evaluate(([l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: l - 1 }, (_, i) => [String(i + 1), 3])), seenBefore: { [l]: true }, tips: t })), [level, TIPS])
  await page.goto(`${base}?sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game() && !!window.hedgerow3d, null, { timeout: 90000 })
  await page.waitForTimeout(8000)
  // Her box on screen from the renderer's projection of her figure.
  const box = await page.evaluate(() => window.hedgerow3d.cathScreenBox?.() ?? null)
  const clip = box
    ? { x: Math.max(0, box.x - box.w * 0.5), y: Math.max(0, box.y - box.h * 0.15), width: box.w * 2, height: box.h * 1.3 }
    : size === 'D' ? { x: 120, y: 410, width: 160, height: 230 } : { x: 30, y: 470, width: 70, height: 100 }
  await page.screenshot({ path: `${out}/cath-${size}-L${level}.png`, clip })
  await ctx.close()
}
await browser.close()
