import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATH_URL ?? 'http://localhost:4180/cathnivore/'
const out = process.env.OUT; const tag = process.env.TAG ?? 'x'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [w, h] of [[390, 844], [375, 667]]) for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, colorScheme: scheme })
  await page.goto(base)
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('[data-hand-card]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/${w}x${h}-${scheme}-${tag}.png` })
  if (scheme === 'light') console.log(w, h, JSON.stringify(await page.evaluate(() => {
    const map = document.querySelector('.map-wrap')?.getBoundingClientRect()
    const names = [...document.querySelectorAll('[data-hand-card] .action-label')].map((el) => { const r = el.getBoundingClientRect(); return [el.textContent.trim().slice(0, 14), Math.round(r.left), Math.round(r.right), Math.round(r.top), el.scrollWidth > el.clientWidth + 1] })
    const dock = document.querySelector('.cath-dock')?.getBoundingClientRect()
    return { mapH: map && Math.round(map.height), dock: dock && [Math.round(dock.top), Math.round(dock.height)], names }
  })))
  // the Saving for deck
  await page.evaluate(() => { const a = document.querySelector('.action-tray .actions'); a.style.scrollBehavior = 'auto'; a.scrollLeft = 99999 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/${w}x${h}-${scheme}-end-${tag}.png` })
  await page.close()
}
await browser.close()
