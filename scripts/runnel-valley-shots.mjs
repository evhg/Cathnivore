// Plan item 70: Runnel's daily as a valley diorama, three dailies at P and D, light and dark.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
// node scripts/runnel-valley-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/runnel/'
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const scheme of ['light', 'dark']) {
    for (const date of scheme === 'light' ? ['', '2026-11-04', '2026-11-08'] : ['']) {
      const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' })
      const p = await ctx.newPage()
      if (date) await p.clock.setFixedTime(new Date(`${date}T10:00:00Z`))
      await p.goto(base + '?nohelp')
      await p.waitForTimeout(1200)
      await p.screenshot({ path: `e2e/screenshots/valley70/${tag}-${n}-${scheme}${date ? '-' + date : ''}.png` })
      await ctx.close()
    }
  }
}
await b.close()
