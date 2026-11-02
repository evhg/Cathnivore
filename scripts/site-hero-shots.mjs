// Plan item 38: the portfolio hero at P (three moments of the print cross-fade, and reduced motion), a tablet
// and D. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
// node scripts/site-hero-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const b = await chromium.launch()
for (const [n, vp, rm] of [['P', { width: 390, height: 844 }, 'no-preference'], ['P-reduced', { width: 390, height: 844 }, 'reduce'], ['T', { width: 820, height: 1180 }, 'no-preference'], ['D', { width: 1440, height: 900 }, 'no-preference']]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: rm })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4186/')
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `e2e/screenshots/site38-${tag}-hero-${n}.png` })
  if (n === 'P') for (const t of [4500, 4500]) {
    await p.waitForTimeout(t)
    await p.screenshot({ path: `e2e/screenshots/site38-${tag}-hero-${n}-${Date.now() % 100000}.png` })
  }
  const w = await p.locator('#hero-cath').evaluate((el) => el.getBoundingClientRect().width / innerWidth)
  console.log(n, 'cath width share', w.toFixed(2))
  await ctx.close()
}
await b.close()
