// Plan item 623: Bea's garden beds (valley and rail) with a part-solved week, P and D, playing and solved. OUT=dir node scripts/runnel-623-shots.mjs [tag] (preview on :4175)
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const out = (process.env.OUT ?? 'e2e/screenshots/r623') + '/'
const base = 'http://localhost:4175/runnel/'
const results = {}
const now = Date.now()
for (const i of [1, 2, 4, 6, 9, 12]) {
  const d = new Date(now - i * 86400000).toISOString().slice(0, 10)
  results[d] = { number: 100 - i, timeMs: 60000 + i * 1000, taps: 10 + (i % 3), par: 11 }
}
const save = { version: 1, daily: {}, practice: {}, results, bestPractice: {}, practiceSolved: 3, seenHelp: true }
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const mode of ['play', 'solved']) {
    const ctx = await b.newContext({ viewport: vp })
    const p = await ctx.newPage()
    await p.addInitScript((s) => localStorage.setItem('runnel:v1', JSON.stringify(s)), save)
    await p.goto(base + (mode === 'solved' ? '?shotwin&nohelp' : '?nohelp&sky=noon,clouds'))
    await p.waitForTimeout(mode === 'solved' ? 5000 : 1500)
    await p.screenshot({ path: `${out}${tag}-${mode}-${n}.png` })
    const m = await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] }
      return { garden: r('.bea-garden'), crops: r('#bea-crops'), rail: r('.rail-garden'), plots: r('#rail-plots'), sign: r('.bea-garden > .farm-sign'), strip: r('#win-strip'), today: r('.bea-crops .is-today svg') }
    })
    console.log(tag, n, mode, JSON.stringify(m))
    await ctx.close()
  }
}
await b.close()
