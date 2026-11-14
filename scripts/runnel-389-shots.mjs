// Plan item 389: Runnel's board and valley at one scale. Shoots the lesson and a daily at P and D and measures
// person height to tile edge, the tiles' border width and the horizon band.
// Usage: npx vite preview --outDir dist-site --port 4190 &  then  TAG=before node scripts/runnel-389-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4190'
const tag = process.env.TAG ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/runnel389'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = [
  ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }],
  ['D', { viewport: { width: 1440, height: 900 } }],
]
const report = {}
for (const [n, o] of SIZES) {
  for (const [name, url] of [['lesson', '/runnel/?lesson'], ['daily', '/runnel/?nohelp']]) {
    const ctx = await b.newContext(o)
    await ctx.addInitScript(() => { try { localStorage.setItem('runnel:v1', JSON.stringify({ seenLesson: true })) } catch {} })
    const p = await ctx.newPage()
    await p.goto(`${base}${url}`)
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${n}-${name}-${tag}.png` })
    report[`${name}-${n}`] = await p.evaluate(() => {
      const tiles = [...document.querySelectorAll('#board polygon.tile')].map((e) => e.getBoundingClientRect())
      const edge = tiles.length ? tiles[0].height / 2 : 0
      const folk = [...document.querySelectorAll('.valley-folk-one:not([hidden])')].filter((e) => e.offsetParent).map((e) => {
        const svg = e.querySelector('svg'); const r = (svg ?? e).getBoundingClientRect()
        return { k: e.getAttribute('data-valley-folk'), h: Math.round(r.height) }
      })
      const people = folk.filter((f) => f.k === 'farmer' || f.k === 'bea')
      const sw = (() => { const t = document.querySelector('#board .cell:not(.stone) polygon.tile'); if (!t) return 0; const cs = getComputedStyle(t); if (cs.vectorEffect === 'non-scaling-stroke') return parseFloat(cs.strokeWidth); const m = t.ownerSVGElement.getScreenCTM(); return +(parseFloat(cs.strokeWidth) * m.a).toFixed(2) })()
      return { tiles: tiles.length, edge: Math.round(edge), folk, ratio: people.map((f) => +(f.h * 0.81 / edge).toFixed(2)), stroke: sw }
    })
    await ctx.close()
  }
}
console.log(JSON.stringify(report, null, 1))
await b.close()
