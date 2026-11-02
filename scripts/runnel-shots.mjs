// Plan item 30: Runnel's puzzle (under cloud shadows), its win and the stats sheet at P and D, plus dark and
// greyscale. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
// node scripts/runnel-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/runnel/'
const out = (n) => `e2e/screenshots/runnel-${tag}-${n}.png`
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(base + '?nohelp&sky=noon,clouds')
    await p.waitForTimeout(900)
    await p.screenshot({ path: out(`puzzle-${n}-${scheme}`) })
    if (scheme === 'light') {
      await p.emulateMedia({ colorScheme: 'light' })
      await p.addStyleTag({ content: 'html{filter:grayscale(1)}' })
      await p.screenshot({ path: out(`puzzle-${n}-grey`) })
      await p.goto(base + '?nohelp&sky=noon,clouds')
      await p.waitForTimeout(600)
      await p.locator('#btn-stats').click()
      await p.waitForTimeout(600)
      await p.screenshot({ path: out(`stats-${n}`) })
    }
    await ctx.close()
  }
}
await b.close()
