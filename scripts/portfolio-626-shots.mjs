// Plan item 626: the portfolio's 'Today in the studio' band at P and D, idle and with a notch focused, plus measures.
// OUT=dir node scripts/portfolio-626-shots.mjs [tag]  (a dist-site preview on :4175)
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const out = (process.env.OUT ?? 'e2e/screenshots/p626') + '/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4175/')
  await p.waitForTimeout(2500)
  if (n === 'P') await p.locator('#studio').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${out}${tag}-${n}.png` })
  const m = await p.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] }
    return { studio: r(document.querySelector('#studio')), track: r(document.querySelector('.studio-track')), stats: r(document.querySelector('.studio .stats')), notches: document.querySelectorAll('.notch').length, label: document.querySelector('.notch')?.getAttribute('aria-label') }
  })
  console.log(tag, n, JSON.stringify(m))
  await p.locator('.notch').nth(-3).focus()
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${out}${tag}-${n}-focus.png` })
  await ctx.close()
}
await b.close()
