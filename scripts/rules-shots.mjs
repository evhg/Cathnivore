// Plan item 56: shots of How to Play, Settings and Credits at P and D, light and dark.
// Needs a preview on BASE (default :4190): `npm run build && npx vite preview --port 4190`.
// Usage: node scripts/rules-shots.mjs <tag> [rules|settings|credits]
import { chromium } from 'playwright'
const tag = process.argv[2] || 'before'
const screen = process.argv[3] || 'rules'
const base = process.env.BASE || 'http://localhost:4190/'
const link = { rules: 'How to Play', settings: 'Settings', credits: 'Credits' }[screen]
const b = await chromium.launch()
for (const [name, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme })
    const p = await ctx.newPage()
    await p.goto(base)
    await p.getByText(link, { exact: true }).first().click()
    await p.waitForTimeout(700)
    const out = `e2e/screenshots/almanac56/${screen}-${tag}-${name}-${scheme}`
    await p.screenshot({ path: `${out}.png` })
    if (screen !== 'rules') await p.screenshot({ path: `${out}-full.png`, fullPage: true })
    if (screen === 'rules' && tag !== 'before') {
      for (const tab of ['Hollowell', 'Cards', 'Producers']) {
        const t = p.getByRole('tab', { name: tab })
        if (await t.count()) { await t.click(); await p.waitForTimeout(300); await p.screenshot({ path: `${out}-${tab}.png` }) }
      }
      if (scheme === 'light') {
        await p.getByRole('searchbox').fill('Squeeze'); await p.waitForTimeout(300)
        await p.screenshot({ path: `${out}-search.png` })
      }
    }
    await ctx.close()
  }
}
await b.close()
