// Plan item 660: Runnel's solved daily at P and D: Bea's and today's plant's boxes, and a 3x crop of the garden.
// OUT=dir node scripts/runnel-660-shots.mjs <tag>  (a dist-site preview on :4175)
import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'after', out = process.env.OUT ?? 'e2e/screenshots/r660'
import { mkdirSync } from 'node:fs'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of [['D', { viewport: { width: 1440, height: 900 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage()
  await p.goto('http://localhost:4175/runnel/?shotwin&nohelp'); await p.waitForTimeout(5000)
  const m = await p.evaluate(() => {
    const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round) }
    return { garden: r('.bea-garden'), runner: r('.bea-runner'), runnerSvg: r('.bea-runner svg'), waiting: r('.bea-waiting'), today: r('.bea-crops .is-today svg'), crops: r('.bea-crops') }
  })
  console.log(s, JSON.stringify(m))
  await p.screenshot({ path: `${out}/${tag}-${s}.png` })
  if (m.garden) { const [x, y, w, h] = m.garden; await p.screenshot({ path: `${out}/${tag}-garden-${s}.png`, clip: { x: Math.max(0, x - 20), y: Math.max(0, y - 40), width: w + 40, height: h + 60 } }) }
  await ctx.close()
}
await b.close()
