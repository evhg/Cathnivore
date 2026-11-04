// Plan item 111: the Hedgerow journey map at 1440x900 and 1280x800, with stop and Cath-token sizes. Needs a dist-site
// preview on :4180. N=<levels cleared> OUT=e2e/screenshots/h111 node scripts/hedgerow-map111-shots.mjs
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const [s, v] of [['D', { width: 1440, height: 900 }], ['D2', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: v })
  await p.goto('http://localhost:4180/hedgerow/?2d')
  await p.evaluate(([st, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 21: true }, tips: t })), [stars(Number(process.env.N ?? 20)), tips])
  await p.goto('http://localhost:4180/hedgerow/'); await p.waitForTimeout(2500)
  await p.screenshot({ path: `${process.env.OUT}/hedge-menu-${s}.png` })
  console.log(s, JSON.stringify(await p.evaluate(() => { const c = document.querySelector('.node.next .level-num').getBoundingClientRect(); const y = document.querySelector('.node.next .you').getBoundingClientRect(); return { coin: [c.width, c.height], you: [y.width, y.height, y.bottom - c.top] } })))
}
await b.close()
