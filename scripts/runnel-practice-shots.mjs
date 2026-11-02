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
  // Lay a valid board: spring, two to the right, then down-left (as e2e-site/runnel-practice.spec.ts does).
  const centres = await p.locator('#ws-board g[data-cell]').evaluateAll((gs) =>
    gs.map((g) => { const r = g.getBoundingClientRect(); return { i: g.dataset.cell, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width } }))
  const near = (x, y) => centres.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a))
  const sb = await p.locator('#ws-board').boundingBox()
  const mid = near(sb.x + sb.width / 2, sb.y + sb.height / 2)
  const w = mid.w
  const r2 = near(mid.x + 2 * w, mid.y)
  const chain = [mid, near(mid.x + w, mid.y), r2, near(r2.x - w / 2, r2.y + w * 0.87), near(r2.x - w * 1.5, r2.y + w * 0.87), near(mid.x - w / 2, mid.y + w * 0.87)]
  for (const c of chain) await p.locator(`#ws-board g[data-cell="${c.i}"]`).click()
  await p.waitForTimeout(700)
  await p.screenshot({ path: out(`workshop-laid-${n}`) })
  await p.goto(base + '?lesson&sky=noon')
  await p.waitForTimeout(900)
  await p.screenshot({ path: out(`lesson-${n}`) })
  await ctx.close()
}
await b.close()
