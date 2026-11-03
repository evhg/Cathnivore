// Plan item 65: the front door at 0.5 s, 5 s and once the street is live, at P, L and D (high quality on D, phone
// tier on P and L), into OUT (default e2e/screenshots/poster65).
//   CATHODE_URL=http://localhost:<port>/nightshift/ node scripts/cathode-front-timeline.mjs [tag]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots/poster65'
const tag = process.argv[2] ?? 'after'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [n, w, h, q] of [['P', 390, 844, 'phone'], ['L', 844, 390, 'phone'], ['D', 1440, 900, 'high']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: n !== 'D' })
  await ctx.addInitScript((qq) => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: qq })), q)
  const p = await ctx.newPage()
  const t0 = Date.now()
  await p.goto(base, { waitUntil: 'commit' })
  await p.waitForTimeout(Math.max(0, 500 - (Date.now() - t0)))
  await p.screenshot({ path: `${out}/${tag}-0.5s-${n}.png` })
  await p.waitForTimeout(Math.max(0, 5000 - (Date.now() - t0)))
  await p.screenshot({ path: `${out}/${tag}-5s-${n}.png` })
  await p.waitForFunction(() => document.getElementById('front-fallback')?.classList.contains('is-off'), null, { timeout: 300_000 }).catch(() => {})
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${tag}-live-${n}.png` })
  console.log(tag, n, 'done')
  await ctx.close()
}
await b.close()
