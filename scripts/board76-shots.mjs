// Plan item 76 shots: the board at round 1 and round 6+, P and D, light and dark. Needs `npm run preview` on :4173.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const out = process.env.OUT ?? 'e2e/screenshots/a76'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]])
  for (const scheme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: vp, colorScheme: scheme })
    await p.goto('http://localhost:4173/')
    await p.getByText('Quick Game').click(); await p.getByRole('button', { name: 'Start' }).click()
    await p.locator('.map-wrap svg.map').waitFor(); await p.waitForTimeout(1200)
    await p.locator('.map-wrap').screenshot({ path: `${out}/board-r1-${s}-${scheme}.png` })
    await p.goto('http://localhost:4173/?e2eAutoplay=1')
    await p.getByText('Quick Game').click(); await p.getByRole('button', { name: 'Start' }).click()
    await p.waitForFunction(() => Number(document.querySelector('svg.map[data-round]')?.dataset.round) >= 6, null, { timeout: 60000 })
    await p.screenshot({ path: `${out}/board-r6-${s}-${scheme}.png` })
    await p.close()
  }
await browser.close()
