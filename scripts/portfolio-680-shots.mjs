// Plan item 680: the portfolio's first screen at P and D: Cath's box, the four game tiles' tops, the headline and body
// sizes. OUT=dir node scripts/portfolio-680-shots.mjs <tag>  (a dist-site preview on :4175)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'x', out = process.env.OUT ?? 'e2e/screenshots/p680'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of [['D', { viewport: { width: 1440, height: 900 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage()
  await p.goto('http://localhost:4175/'); await p.waitForTimeout(3500)
  const m = await p.evaluate(() => {
    const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round) }
    const cath = document.querySelector('[class*="cath"] svg, .hero-cath, [data-cath]')
    const h1 = document.querySelector('h1'), body = document.querySelector('h1 ~ p, .hero p')
    const tiles = [...document.querySelectorAll('a[href*="cathnivore"], a[href*="runnel"], a[href*="hedgerow"], a[href*="nightshift"]')].map((a) => R(a))
    return { cath: R(cath), cathClass: cath?.getAttribute('class') ?? cath?.parentElement?.className, h1: R(h1), h1fs: h1 ? getComputedStyle(h1).fontSize : null, bodyfs: body ? getComputedStyle(body).fontSize : null, tiles }
  })
  console.log(s, JSON.stringify(m))
  await p.screenshot({ path: `${out}/${tag}-${s}.png` })
  await ctx.close()
}
await b.close()
