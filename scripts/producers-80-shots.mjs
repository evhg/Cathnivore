// Plan item 80: the producers' portraits on the Setup cards and a close-up sheet, at P and D, light and dark.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then node scripts/producers-80-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto('http://localhost:4186/cathnivore/')
    await p.getByText('Quick Game').click()
    await p.waitForTimeout(900)
    await p.screenshot({ path: `e2e/screenshots/p80/${tag}-${n}-${scheme}-setup.png` })
    if (n === 'D' && scheme === 'light') {
      const card = p.locator('.producer-grid')
      await card.screenshot({ path: `e2e/screenshots/p80/${tag}-cards.png` })
    }
    await ctx.close()
  }
}
await b.close()
