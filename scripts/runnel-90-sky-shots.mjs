import { chromium } from 'playwright'
const [tag, ...rest] = process.argv.slice(2)
const b = await chromium.launch()
for (const spec of rest) {
  const [n, scheme, sky] = spec.split(':')
  const vp = n === 'P' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
  const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:4186/runnel/?nohelp&sky=${sky}`)
  await p.locator('.tiles > g.cell').first().waitFor(); await p.waitForTimeout(600)
  await p.screenshot({ path: `e2e/screenshots/r90/${tag}-${n}-${scheme}-${sky.replace(',', '-')}.png` })
  await ctx.close()
}
await b.close()
