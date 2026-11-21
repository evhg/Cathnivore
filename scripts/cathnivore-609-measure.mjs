// Plan item 609: the phone title's Cath against the board. Prints her figure's box, the board's (its map) box, how
// much of her face and torso box the board covers (in front of her when it sits above her in the stack), and whether
// Campaign, Quick Game and the Daily are on screen without scrolling. Usage: a preview on :4191, then
//   node scripts/cathnivore-609-measure.mjs   (SAVE=mid for a campaign under way)
import { chromium } from '@playwright/test'
const base = process.env.CATH_URL ?? 'http://localhost:4191/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [w, h] of [[390, 844], [375, 667], [430, 932]]) {
  for (const save of ['fresh', 'mid']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true })
    if (save === 'mid') await ctx.addInitScript(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth'] })))
    const p = await ctx.newPage()
    await p.goto(base)
    await p.waitForTimeout(2500)
    const r = await p.evaluate(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } }
      const cath = document.querySelector('.title-art.title-table .title-cath svg') ?? document.querySelector('.title-art.title-table .title-cath')
      const board = document.querySelector('.title-art.title-table .title-board')
      const map = board.querySelector('.map') ?? board
      const zc = Number(getComputedStyle(document.querySelector('.title-art.title-table .title-cath')).zIndex) || 0
      const zb = Number(getComputedStyle(board).zIndex) || 0
      const menu = [...document.querySelectorAll('.title-menu .title-cta')].map((e) => e.getBoundingClientRect().bottom)
      return { cath: box(cath), board: box(map), boardBox: box(board), front: zc > zb ? 'cath' : 'board', menuBottom: Math.round(Math.max(...menu)), vh: innerHeight, scroll: document.scrollingElement.scrollHeight > innerHeight }
    })
    console.log(w, h, save, JSON.stringify(r))
    await ctx.close()
  }
}
await b.close()
