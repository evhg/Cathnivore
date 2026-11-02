// Plan item 38: Cath's Week tiles on /games/ mid-week (Runnel at 2 of 3, so "1 to go") at P and D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then node scripts/site-week-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4186/games/')
  // Two dailies since this week's baseline.
  await p.evaluate(() => {
    const d = (i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, results: { [d(0)]: { taps: 9, par: 10 }, [d(1)]: { taps: 9, par: 10 } } }))
  })
  await p.reload()
  await p.waitForTimeout(800)
  await p.locator('#week').scrollIntoViewIfNeeded()
  await p.waitForTimeout(500)
  await p.locator('#week').screenshot({ path: `e2e/screenshots/site38-${tag}-week-${n}.png` })
  await ctx.close()
}
await b.close()
