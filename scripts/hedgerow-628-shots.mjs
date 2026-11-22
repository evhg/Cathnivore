// Plan item 628: the build shop (tray) as seed packets, levels 21, 34 and 3 (2D) at P, D and L.
//   npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//   OUT=<dir> TAG=before node scripts/hedgerow-628-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'e2e/screenshots/h628', tag = process.env.TAG ?? 'after'
const levels = (process.env.LEVELS ?? '21,34,3').split(',')
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: [390, 844, true, 2], D: [1440, 900, false, 1], L: [844, 390, true, 2] }
for (const lv of levels) for (const [s, [w, h, touch, dpr]] of Object.entries(SIZES)) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch })
  const p = await ctx.newPage()
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await p.goto(`${base}/hedgerow/?2d`)
  await p.evaluate(([st, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { [l]: true }, tips: t })), [stars, tips, lv])
  await p.goto(`${base}/hedgerow/?2d&sandbox=1&level=${lv}`)
  await p.waitForFunction(() => !!window.hedgerow?.game?.(), null, { timeout: 60000 })
  await p.addStyleTag({ content: '#intro { display: none !important; }' })
  await p.waitForTimeout(1200)
  await p.evaluate(() => { const g = window.hedgerow.game(); g.marks = Math.min(g.marks, 450); window.hedgerow.refresh?.() })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${out}/${tag}-l${lv}-${s}.png` })
  const t = p.locator('.tray-wrap').first()
  if (await t.count()) await t.screenshot({ path: `${out}/${tag}-tray-l${lv}-${s}.png` })
  const k = p.locator('.tray-tower[data-answers]:not([disabled])').first()
  if (s === 'D' && await k.count()) { await k.click(); await p.waitForTimeout(600); await t.screenshot({ path: `${out}/${tag}-tray-picked-l${lv}-${s}.png` }) }
  await ctx.close()
}
await b.close()
