import { chromium } from 'playwright'
const tag = process.argv[2] || 'before'
const base = process.env.BASE || 'http://localhost:4190/'
const b = await chromium.launch()
for (const [name, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme })
    const p = await ctx.newPage()
    await p.goto(base)
    await p.getByText('How to Play').first().click()
    await p.waitForTimeout(600)
    await p.screenshot({ path: `e2e/screenshots/almanac56/${tag}-${name}-${scheme}.png` })
    if (tag !== 'before') {
      for (const tab of ['Hollowell', 'Cards', 'Producers']) {
        const t = p.getByRole('tab', { name: tab })
        if (await t.count()) { await t.click(); await p.waitForTimeout(300); await p.screenshot({ path: `e2e/screenshots/almanac56/${tag}-${name}-${scheme}-${tab}.png` }) }
      }
      if (scheme === 'light') {
        await p.getByRole('searchbox').fill('Squeeze'); await p.waitForTimeout(300)
        await p.screenshot({ path: `e2e/screenshots/almanac56/${tag}-${name}-search.png` })
      }
    }
    await ctx.close()
  }
}
await b.close()
