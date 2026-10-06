// ROADMAP 104: Hedgerow screenshots (level map plus a mid-wave field, 2D and 3D) into e2e/screenshots/.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/hedgerow-shots.mjs
// Set PLAYWRIGHT_CHROMIUM_PATH if the pinned Chromium revision is missing (see CLAUDE.md).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
for (const [name, w, h] of [['phone', 844, 390], ['desktop', 1440, 900]]) {
  for (const mode of ['2d', '3d']) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(`${base}?sandbox=1${mode === '2d' ? '&2d' : ''}`)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `e2e/screenshots/${name}-hedgerow-map-${mode}.png` })
    await page.locator('button.node:not([disabled])').first().click()
    for (let i = 0; i < 12 && !(await page.locator('#screen-play:visible').count()); i++) {
      const next = page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first()
      if (await next.count()) await next.click().catch(() => {})
      await page.waitForTimeout(400)
    }
    await page.evaluate(async () => {
      const hg = window.hedgerow
      const g = hg.game()
      const kinds = ['scarecrow', 'beehive', 'hedgerow', 'stall', 'pond', 'barn']
      let k = 0
      for (let r = 0; r < g.level.rows && k < 8; r++)
        for (let c = 0; c < g.level.cols && k < 8; c++)
          if (hg.place(g, kinds[k % kinds.length], c, r).ok) k++
      hg.sendWave(g, true)
    })
    await page.waitForTimeout(mode === '2d' ? 3000 : 6000)
    await page.screenshot({ path: `e2e/screenshots/${name}-hedgerow-field-${mode}.png` })
    await page.close()
  }
}
await browser.close()
