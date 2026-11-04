import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'before'
const base = 'http://localhost:4186/runnel/'
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const scheme of ['light', 'dark']) {
    for (const [name, q] of [['tut', ''], ['daily', '?nohelp'], ['dusk', '?nohelp&sky=dusk,clear'], ['rain', '?nohelp&sky=noon,drizzle']]) {
      if (scheme === 'dark' && name !== 'tut' && name !== 'daily') continue
      const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' })
      const p = await ctx.newPage()
      await p.clock.setFixedTime(new Date('2026-11-04T10:00:00Z'))
      await p.goto(base + q)
      await p.waitForTimeout(1500)
      await p.screenshot({ path: `e2e/screenshots/r77/${tag}-${n}-${scheme}-${name}.png` })
      await ctx.close()
    }
  }
}
await b.close()
