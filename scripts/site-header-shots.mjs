// Plan item 38: the portfolio, a case study and /games/ scrolled 1.5 screens, at P and D, to check the
// header over scrolled content. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &
// then node scripts/site-header-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const pages = [['home', '/'], ['case', '/work/games/'], ['games', '/games/']]
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  for (const [name, path] of pages) {
    await p.goto('http://localhost:4186' + path)
    await p.waitForTimeout(800)
    await p.screenshot({ path: `e2e/screenshots/site38-${tag}-${name}-${n}-top.png` })
    await p.evaluate(() => window.scrollTo(0, innerHeight * 1.5))
    await p.waitForTimeout(600)
    await p.screenshot({ path: `e2e/screenshots/site38-${tag}-${name}-${n}-scrolled.png` })
  }
  await ctx.close()
}
await b.close()
