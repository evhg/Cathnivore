// Plan item 54: Setup shots at P, L and D, light and dark. Needs a preview of dist/ (default :4190).
// node scripts/setup-shots.mjs <outdir> [port]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const out = process.argv[2] ?? 'e2e/screenshots/setup54'
const port = process.argv[3] ?? '4190'
mkdirSync(out, { recursive: true })
const sizes = { P: [390, 844], L: [844, 390], D: [1440, 900] }
const browser = await chromium.launch()
for (const [tag, [w, h]] of Object.entries(sizes)) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: tag !== 'D' })
    const page = await ctx.newPage()
    await page.goto(`http://localhost:${port}/`)
    await page.getByText('Quick Game').click()
    await page.locator('main.setup').waitFor()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/setup-${tag}-${scheme}.png` })
    if (tag === 'P' && scheme === 'light') await page.screenshot({ path: `${out}/setup-${tag}-full.png`, fullPage: true })
    await ctx.close()
  }
}
await browser.close()
