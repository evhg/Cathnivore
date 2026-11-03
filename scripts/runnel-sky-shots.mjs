// Plan item 50: Runnel's board under each time of day (noon, golden hour, dusk) and solved, at P and D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
// node scripts/runnel-sky-shots.mjs [tag]
import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/runnel/'
const out = (n) => `e2e/screenshots/runnel50/${tag}-${n}.png`
const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce', deviceScaleFactor: n === 'P' ? 2 : 1 })
  const p = await ctx.newPage()
  for (const sky of ['noon,clear', 'golden,breeze', 'dusk,clear', 'dusk,drizzle']) {
    await p.goto(`${base}?nohelp&sky=${sky}`)
    await p.waitForTimeout(900)
    await p.screenshot({ path: out(`${sky.replace(',', '-')}-${n}`) })
  }
  // A player who solved Monday and two dailies last week: the week strip and Bea's beds have something in them.
  const res = (n) => ({ number: n, timeMs: 90000, taps: 50, par: 41 })
  await p.evaluate((r) => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results: r, bestPractice: {}, practiceSolved: 0, seenHelp: true })), {
    '2026-10-26': res(30), '2026-10-29': res(33), '2026-11-02': res(37),
  })
  await p.goto(`${base}?nohelp&sky=noon,clear`)
  await p.waitForTimeout(900)
  await p.screenshot({ path: out(`week-${n}`) })
  await p.evaluate(() => localStorage.clear())
  await p.goto(`${base}?nohelp&shotwin&sky=dusk,clear`)
  await p.waitForTimeout(1200)
  await p.screenshot({ path: out(`win-dusk-${n}`) })
  await ctx.close()
  // Night: the dark palette, under a dusk sky.
  const night = await b.newContext({ viewport: vp, colorScheme: 'dark', reducedMotion: 'reduce', deviceScaleFactor: n === 'P' ? 2 : 1 })
  const np = await night.newPage()
  await np.goto(`${base}?nohelp&sky=dusk,clear`)
  await np.waitForTimeout(900)
  await np.screenshot({ path: out(`night-${n}`) })
  await night.close()
}
await b.close()
