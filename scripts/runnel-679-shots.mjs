// Plan item 679: Runnel's solved daily at D (1440x900, 1280x800) and P: the result's boxes and a shot each.
// OUT=dir node scripts/runnel-679-shots.mjs <tag>  (a dist-site preview on :4175)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after', out = process.env.OUT ?? 'e2e/screenshots/r679'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const sizes = [['D', { viewport: { width: 1440, height: 900 } }], ['D1280', { viewport: { width: 1280, height: 800 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]
for (const [s, o] of sizes) {
  const ctx = await b.newContext(o); const p = await ctx.newPage()
  await p.goto('http://localhost:4175/runnel/?shotwin&nohelp'); await p.waitForTimeout(5000)
  const m = await p.evaluate(() => {
    const r = (q) => { const e = document.querySelector(q); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round) }
    return { strip: r('#win-strip'), plant: r('#strip-plant svg'), board: r('#board'), garden: r('.bea-garden'), rail: r('#rail'), scroll: document.scrollingElement.scrollHeight - innerHeight, stripScroll: (() => { const e = document.getElementById('win-strip'); return e.scrollHeight - e.clientHeight })() }
  })
  console.log(s, JSON.stringify(m))
  await p.screenshot({ path: `${out}/${tag}-${s}.png` })
  await ctx.close()
}
await b.close()
