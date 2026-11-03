// Plan item 50: Runnel's board under each time of day (noon, golden hour, dusk) and solved, at P and D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
// node scripts/runnel-sky-shots.mjs [tag]
import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/runnel/'
const out = (n) => `e2e/screenshots/runnel50/${tag}-${n}.png`
const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce', deviceScaleFactor: n === 'P' ? 2 : 1 })
  const p = await ctx.newPage()
  for (const sky of ['noon,clear', 'golden,breeze', 'dusk,clear', 'dusk,drizzle']) {
    await p.goto(`${base}?nohelp&sky=${sky}`)
    await p.waitForTimeout(900)
    await p.screenshot({ path: out(`${sky.replace(',', '-')}-${n}`) })
  }
  await p.goto(`${base}?nohelp&shotwin&sky=dusk,clear`)
  await p.waitForTimeout(1200)
  await p.screenshot({ path: out(`win-dusk-${n}`) })
  await ctx.close()
}
await b.close()
