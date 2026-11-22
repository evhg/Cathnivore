// Plan item 654: the board's Doubt leaflets and their peek card, P and D, light and dark. Needs a dist-site preview on :4180.
import { chromium } from '@playwright/test'
const out = process.argv[2]
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of [['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['D', { viewport: { width: 1440, height: 900 } }]]) {
  for (const scheme of ['light', 'dark']) {
    const p = await (await browser.newContext({ ...o, colorScheme: scheme })).newPage()
    await p.goto('http://localhost:4180/cathnivore/'); await p.waitForTimeout(1200)
    await p.getByText('Quick Game').click(); await p.waitForTimeout(600)
    await p.getByRole('button', { name: 'Start' }).click()
    if (s === 'D') await p.mouse.move(2, 2)
    await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/game-${s}-${scheme}.png` })
    const d = p.locator('[data-piece="d"][data-peekable]').first()
    if (await d.count()) { await d.click(); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/peek-${s}-${scheme}.png` }) }
    await p.close()
  }
}
await browser.close()
