// Plan item 47: Runnel's lesson board at P and D (the four tiles centred on the framed board, clear of the
// spring house label and the screen edge), and the win sheet's postcard in the swipe row.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4190 &  then
//        BASE=http://localhost:4190 TAG=after node scripts/runnel-lesson-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4190'
const tag = process.env.TAG ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/critique47'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = [
  ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }],
  ['D', { viewport: { width: 1440, height: 900 } }],
]
const report = {}
for (const [n, o] of SIZES) {
  const p = await b.newPage(o)
  await p.goto(`${base}/runnel/?lesson`)
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${n}-runnel-lesson-${tag}.png` })
  report[`lesson-${n}`] = await p.evaluate(() => {
    const tiles = [...document.querySelectorAll('.tile, [data-tile], .cell')].filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect())
    if (!tiles.length) return 'no tiles'
    const l = Math.min(...tiles.map((r) => r.left)), r = Math.max(...tiles.map((r) => r.right))
    const t = Math.min(...tiles.map((r) => r.top)), bt = Math.max(...tiles.map((r) => r.bottom))
    return { n: tiles.length, l: Math.round(l), r: Math.round(r), t: Math.round(t), b: Math.round(bt), vw: innerWidth }
  })
  await p.close()
}
console.log(JSON.stringify(report))
await b.close()
