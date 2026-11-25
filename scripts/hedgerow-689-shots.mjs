// Plan item 689: Cath's level-up badge at its peak on level 34 (2D sandbox), P and D. OUT=dir node scripts/hedgerow-689-shots.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'x', out = process.env.OUT ?? 'e2e/screenshots/h689', lvl = process.env.LEVEL ?? '34'
const base = process.env.SITE_URL ?? 'http://localhost:4186'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const [s, o] of [['D', { viewport: { width: 1440, height: 900 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage()
  await p.goto(`${base}/hedgerow/?sandbox=1&2d`)
  await p.evaluate(([st, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { [l]: true }, tips: t })), [stars, tips, lvl])
  await p.goto(`${base}/hedgerow/?sandbox=1&2d&level=${lvl}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 }); await p.waitForTimeout(1500)
  await p.evaluate(() => { const go = document.querySelector('.intro:not([hidden]) .intro-go'); go?.click() })
  if (process.env.TOP) { await p.evaluate(() => { const h = window.hedgerow.game().hero; h.y = h.ty = 0.6 }); await p.waitForTimeout(300) }
  await p.evaluate(() => window.hedgerow.heroUp())
  await p.waitForTimeout(250)
  const box = await p.evaluate(() => { const r = document.querySelector('.lvl-badge')?.getBoundingClientRect(); const h = document.querySelector('.hud')?.getBoundingClientRect(); return { badge: r && [r.left, r.top, r.right, r.bottom].map(Math.round), hud: h && [h.left, h.top, h.right, h.bottom].map(Math.round) } })
  console.log(s, JSON.stringify(box))
  await p.screenshot({ path: `${out}/${tag}-${s}-rise.png` })
  await ctx.close()
}
await b.close()
