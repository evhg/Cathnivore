// Plan item 74: the Hedgerow journey map at P and D, fresh and mid saves. Needs a dist-site preview on :4186.
// Usage: node scripts/hedgerow-map74-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  for (const upTo of [0, 13]) {
    const p = await (await b.newContext({ viewport: vp })).newPage()
    await p.goto('http://localhost:4186/hedgerow/?2d')
    await p.evaluate((n) => {
      const stars = {}, seenBefore = {}
      for (let i = 1; i <= n; i++) { stars[i] = 3; seenBefore[i] = true }
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: {}, bank: {} }))
    }, upTo)
    await p.reload()
    await p.waitForTimeout(1800)
    await p.screenshot({ path: `e2e/screenshots/bugs74/hmap-${tag}-${n}-${upTo}.png` })
    await p.context().close()
  }
}
await b.close()
