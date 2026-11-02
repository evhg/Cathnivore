// Plan item 37: the Orchard's rows of trees (some solved, some in fruit, the current one with Cath) at P and
// D, light and dark. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
// node scripts/runnel-orchard-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const orchard = {}
for (let n = 1; n <= 12; n++) orchard[n] = { drops: n % 3 === 0 ? 2 : 3, taps: 10, timeMs: 30000 }
const save = { version: 1, daily: {}, practice: {}, results: {}, bestPractice: {}, practiceSolved: 0, seenHelp: true, orchard }
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.addInitScript((s) => localStorage.setItem('runnel:v1', JSON.stringify(s)), save)
  await p.goto('http://localhost:4186/runnel/?nohelp&mode=orchard&sky=noon,clouds')
  await p.waitForTimeout(900)
  await p.screenshot({ path: `e2e/screenshots/runnel37-${tag}-orchard-${n}-${scheme}.png` })
  await ctx.close()
}
await b.close()
