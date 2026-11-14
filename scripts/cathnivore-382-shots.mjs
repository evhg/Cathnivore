// Plan item 382: the title's market square at P and D, light and dark, plus a backdrop chroma sample behind the bunting.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-382-shots.mjs http://localhost:4191 <outdir> [tag]
import { chromium } from '@playwright/test'
const [base, out, tag = 'x'] = [process.argv[2], process.argv[3], process.argv[4]]
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const scheme of ['light', 'dark'])
  for (const [n, w, h, t] of [['P', 390, 844, true], ['D', 1440, 900, false], ['D2', 1280, 800, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: t, colorScheme: scheme })
    const p = await ctx.newPage()
    await p.goto(base + '/')
    await p.locator('.title-menu').waitFor()
    await p.waitForTimeout(1500)
    await p.screenshot({ path: `${out}/title-${n}-${scheme}-${tag}.png` })
    await ctx.close()
  }
await b.close()
