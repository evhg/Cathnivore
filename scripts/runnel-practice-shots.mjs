// Plan item 39: Runnel Practice, the Board sheet, Bea's workshop and the lesson at P and D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
// node scripts/runnel-practice-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/runnel/'
const out = (n) => `e2e/screenshots/runnel-practice-${tag}-${n}.png`
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(base + '?nohelp&mode=practice&sky=noon')
  await p.waitForTimeout(900)
  await p.screenshot({ path: out(`practice-${n}`) })
  const chip = p.locator('#btn-board')
  if (await chip.count()) {
    await chip.click()
    await p.waitForTimeout(500)
    await p.screenshot({ path: out(`sheet-${n}`) })
    await p.locator('#board-sheet #btn-workshop').click()
  } else {
    await p.locator('#btn-workshop').click()
  }
  await p.waitForTimeout(600)
  await p.screenshot({ path: out(`workshop-${n}`) })
  // Lay a few channels from the spring outward.
  const tiles = p.locator('#ws-board g[data-cell]')
  const count = await tiles.count()
  if (count > 6) {
    const mid = Math.floor(count / 2)
    for (const [a, c] of [[mid, mid + 1], [mid, mid - 1]]) {
      await tiles.nth(a).click(); await tiles.nth(c).click()
    }
    await p.waitForTimeout(400)
    await p.screenshot({ path: out(`workshop-laid-${n}`) })
  }
  await p.goto(base + '?lesson&sky=noon')
  await p.waitForTimeout(900)
  await p.screenshot({ path: out(`lesson-${n}`) })
  await ctx.close()
}
await b.close()
