// Plan item 631: /games/'s stall hero at P and D, with Cath's and the counter's boxes.
// OUT=dir node scripts/games-631-shots.mjs [tag]  (a dist-site preview on :4175)
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const out = (process.env.OUT ?? 'e2e/screenshots/g631') + '/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4175/games/')
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}${tag}-${n}.png` })
  const m = await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] }
    return { cath: r('#hero-cath svg'), mini: r('#hero-cath-mini svg'), stall: r('.hero-stall svg'), wares: [...document.querySelectorAll('.stall-ware')].map((e) => e.getAttribute('href')) }
  })
  console.log(tag, n, JSON.stringify(m))
  await ctx.close()
}
await b.close()
