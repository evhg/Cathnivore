// Plan item 632: Cathnivore's desktop table in a quick game (light and dark), with the board's and figures' boxes.
// OUT=dir node scripts/cathnivore-632-shots.mjs [tag]  (a dist-site preview on :4175)
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const out = (process.env.OUT ?? 'e2e/screenshots/c632') + '/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, vp] of [['D', { width: 1440, height: 900 }], ['P', { width: 390, height: 844 }]]) for (const scheme of n === 'D' ? ['light', 'dark'] : ['light']) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: scheme })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4175/cathnivore/?e2eHandFan=1')
  await p.waitForTimeout(1500)
  await p.getByText('Quick Game').click(); await p.waitForTimeout(800)
  await p.getByRole('button', { name: 'Start' }).click()
  if (n === 'D') await p.mouse.move(2, 2)
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}${tag}-${n}-${scheme}.png` })
  const m = await p.evaluate(() => {
    const r = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] }
    const board = document.querySelector('.board svg, svg.board, [data-board] svg, .board')
    return { board: r(board), boardCls: board?.getAttribute('class'), figures: [...document.querySelectorAll('[class*="figure"], [class*="producer"]')].slice(0, 6).map((e) => [e.className?.baseVal ?? e.className, r(e)]) }
  })
  console.log(tag, n, scheme, JSON.stringify(m))
  await ctx.close()
}
await b.close()
