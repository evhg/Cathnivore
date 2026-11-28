// Plan item 757: level 27 in 3D with a round on the lane, P and D: do Hollowell's vans read as vans (glass, wheels,
// a gap between them)? Also logs the convoy stats (drawn vs columned).
// Usage: npx vite preview --outDir dist-site --port 4181 &
//        BASE=http://localhost:4181 OUT=e2e/screenshots/h757 node scripts/hedgerow-757-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4181'
const out = process.env.OUT ?? 'e2e/screenshots/h757'
const level = Number(process.env.LEVEL ?? 27)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, D: { viewport: { width: 1440, height: 900 } } }
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const [s, o] of Object.entries(SIZES)) {
  if (process.env.ONLY && process.env.ONLY !== s) continue
  const ctx = await browser.newContext(o)
  const p = await ctx.newPage()
  await p.goto(`${base}/hedgerow/?2d`)
  await p.evaluate(([l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { [String(l)]: true }, seen: Object.fromEntries(['van','drone','truck','influencer','courier','hatchback','wrapped','phantom','lawyer','lobbyist','sprinter','lorry','pickup','quad','steel','artic'].map((k) => [k, true])), tips: t })), [level, tips])
  await p.goto(`${base}/hedgerow/?sandbox=1&level=${level}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
  await p.waitForFunction(() => window.hedgerow.camSettled?.() ?? true, null, { timeout: 90000 })
  await p.evaluate(() => { const h = window.hedgerow; h.sendWave(h.game(), true) })
  for (const t of [7, 14]) {
    await p.waitForTimeout(t === 7 ? 7000 : 7000)
    await p.screenshot({ path: `${out}/l${level}-${t}s-${s}.png` })
  }
  const m = await p.evaluate(() => window.hedgerow.convoy?.() ?? null)
  console.log(s, JSON.stringify(m)?.slice(0, 300))
  await ctx.close()
}
await browser.close()
