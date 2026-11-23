// Plan item 662: a new vehicle's field-guide card at P and D, 2D (and 3D with HG_3D=1), level 34 between rounds:
// the card's and board's boxes, the card's share of the board (D) / viewport (P). OUT=dir node scripts/hedgerow-662-shots.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after', out = process.env.OUT ?? 'e2e/screenshots/h662'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const modes = process.env.HG_3D ? ['2d', '3d'] : ['2d']
for (const mode of modes) for (const [s, o] of [['D', { viewport: { width: 1440, height: 900 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage()
  await p.goto(`http://localhost:4175/hedgerow/?sandbox=1&intro=hold&level=34${mode === '2d' ? '&2d' : ''}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
  await p.evaluate(() => { const hg = window.hedgerow; hg.sendWave(hg.game(), true) })
  await p.waitForSelector('.intro:not([hidden]) .intro-reach', { timeout: 30000 }); await p.waitForTimeout(1500)
  const m = await p.evaluate(() => {
    const R = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height } }
    const card = R('.intro:not([hidden]) .intro-sheet'), board = R('#canvas') ?? R('canvas')
    const ov = card && board ? Math.max(0, Math.min(card.x + card.w, board.x + board.w) - Math.max(card.x, board.x)) * Math.max(0, Math.min(card.y + card.h, board.y + board.h) - Math.max(card.y, board.y)) : 0
    return { card, board, boardShare: board ? +(ov / (board.w * board.h)).toFixed(3) : null, viewShare: card ? +(card.w * card.h / (innerWidth * innerHeight)).toFixed(3) : null }
  })
  console.log(mode, s, JSON.stringify(m))
  await p.screenshot({ path: `${out}/${tag}-${mode}-${s}.png` })
  await ctx.close()
}
await b.close()
