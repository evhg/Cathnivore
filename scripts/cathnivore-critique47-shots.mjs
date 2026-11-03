// Plan item 47: Cathnivore's critique bugs at P and D: the farm's producer thumbnails, the phone plan cards'
// effect lines, and the desktop Actions panel while the AI teammate takes its turn.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4190 &  then
//        BASE=http://localhost:4190 TAG=after node scripts/cathnivore-critique47-shots.mjs
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
  await p.goto(`${base}/cathnivore/?e2eTeammateShow=1`)
  await p.getByText('Quick Game').click()
  await p.getByRole('button', { name: 'Start' }).click()
  await p.locator('.game').waitFor()
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${n}-cath-game-${tag}.png`, fullPage: n === 'P' })
  report[`${n}-thumbs`] = await p.evaluate(() =>
    [...document.querySelectorAll('.farm img, .farm svg, [class*="farm"] [class*="thumb"]')].slice(0, 12).map((e) => {
      const r = e.getBoundingClientRect()
      return `${e.tagName}.${typeof e.className === 'string' ? e.className : e.className.baseVal} ${Math.round(r.width)}x${Math.round(r.height)} kids=${e.childElementCount}`
    }),
  )
  // Clipped text in the plan cards: an element whose text overflows its box.
  report[`${n}-clipped`] = await p.evaluate(() =>
    [...document.querySelectorAll('.game *')]
      .filter((e) => e.childElementCount === 0 && e.textContent.trim() && e.getClientRects().length)
      .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)
      .filter((e) => ['hidden', 'clip'].includes(getComputedStyle(e).overflow) || getComputedStyle(e).textOverflow === 'ellipsis' || +getComputedStyle(e).webkitLineClamp > 0)
      .slice(0, 20)
      .map((e) => `${e.className} | ${e.textContent.trim().slice(0, 50)}`),
  )
  await p.close()
}
console.log(JSON.stringify(report, null, 1))
await b.close()
