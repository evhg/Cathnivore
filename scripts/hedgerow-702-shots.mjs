// Plan item 702: the act map at P and D from the plan-shots save (30 levels won, act 4 next).
//   npm run build:site && npx vite preview --outDir dist-site --port 4180 &   then   node scripts/hedgerow-702-shots.mjs http://localhost:4180 <outdir> <tag>
import { chromium } from '@playwright/test'
const [base, out, tag] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const stars = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [String(i + 1), 3]))
for (const [n, opts] of [['D', { viewport: { width: 1440, height: 900 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
  const p = await (await b.newContext({ ...opts, colorScheme: process.env.SCHEME ?? 'light' })).newPage()
  await p.goto(`${base}/hedgerow/?2d`)
  await p.evaluate((st) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 21: true, 27: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true } })), stars)
  await p.goto(`${base}/hedgerow/`); await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${tag}-${n}.png` })
  await p.context().close()
}
await b.close()
