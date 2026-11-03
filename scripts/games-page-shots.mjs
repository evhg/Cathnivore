import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'before'
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4186/games/')
  await p.waitForTimeout(2000)
  await p.screenshot({ path: `e2e/screenshots/bugs74/games-${tag}-${n}.png` })
  await p.screenshot({ path: `e2e/screenshots/bugs74/games-${tag}-${n}-full.png`, fullPage: true })
  await ctx.close()
}
await b.close()
