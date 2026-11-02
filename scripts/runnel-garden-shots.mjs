// Plan item 37: Bea's garden drawn in code, with a seeded save (crops at every stage, a visitor, event crops), at P and D in light and dark.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then node scripts/runnel-garden-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/runnel/'
const results = {}
const today = new Date().toISOString().slice(0, 10)
for (let i = 0; i < 20; i++) {
  const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
  if (i === 0) continue
  results[d] = { number: 100 - i, timeMs: 60000 + i * 1000, taps: 10 + (i % 3), par: 11 }
}
const save = { version: 1, daily: {}, practice: {}, results, bestPractice: {}, practiceSolved: 3, seenHelp: true, eventCrops: ['autumn-2026', 'spring-2026'] }
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.addInitScript((s) => localStorage.setItem('runnel:v1', JSON.stringify(s)), save)
  await p.goto(base + '?nohelp&sky=noon,clouds')
  await p.waitForTimeout(900)
  if (n === 'D') await p.screenshot({ path: `e2e/screenshots/runnel37-${tag}-board-${n}-${scheme}.png` })
  await p.locator('#btn-stats').click()
  await p.waitForTimeout(600)
  await p.locator('#garden').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `e2e/screenshots/runnel37-${tag}-garden-${n}-${scheme}.png` })
  const text = await p.evaluate(() => document.body.innerText)
  console.log(n, scheme, 'pictographic:', /\p{Extended_Pictographic}/u.test(text), (text.match(/\p{Extended_Pictographic}/gu) || []).join(''))
  await ctx.close()
}
await b.close()
