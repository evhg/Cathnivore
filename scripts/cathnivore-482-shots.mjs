// Plan item 482: the desktop title's focal point. Measures the board, its hexes, Cath, the menu at several desktop sizes
// and shoots them into OUT. npm run build && npx vite preview --port 4191 &  then  node scripts/cathnivore-482-shots.mjs [tag]
import { chromium } from '@playwright/test'
const out = process.argv[2] ?? 'x'
import { mkdirSync } from 'node:fs'
const S = process.env.OUT ?? 'e2e/screenshots/t482'
mkdirSync(S, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [w, h] of [[1440, 900], [1280, 800], [1920, 1080], [1100, 800], [1024, 768]]) for (const scheme of w === 1440 ? ['light', 'dark'] : ['light']) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme })
  await ctx.addInitScript(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth'] })))
  const p = await ctx.newPage()
  await p.goto('http://localhost:4191/')
  await p.waitForTimeout(2500)
  const m = await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    const hexes = [...document.querySelectorAll('.title-board .region-hex > polygon:first-of-type')].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 20)
    const hx = hexes.length ? [Math.min(...hexes.map((b) => b.left)), Math.min(...hexes.map((b) => b.top)), Math.max(...hexes.map((b) => b.right)), Math.max(...hexes.map((b) => b.bottom))].map(Math.round) : null
    return { board: r('.title-board'), map: r('.title-board .map'), hexes: hx, nhex: hexes.length, cath: r('.title-cath svg'), line: r('.title-cath-line'), menu: r('.title-menu'), hang: r('.title-hang svg'), front: r('.title-table-front'), ritual: r('.daily-ritual:not(.is-compact)'), tag: r('.title-tagline') }
  })
  console.log(w, h, scheme, JSON.stringify(m))
  if (h === 900 || w === 1280 || w === 1920) await p.screenshot({ path: `${S}/${out}-${w}-${scheme}.png` })
  if (w === 1440 && scheme === 'light') await p.screenshot({ path: `${S}/${out}-menu-zoom.png`, clip: { x: 0, y: 280, width: 900, height: 520 } })
  await ctx.close()
}
await b.close()
