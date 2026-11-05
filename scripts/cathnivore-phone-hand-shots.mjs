// Plan item 164: the Cathnivore phone hand (a Quick Game at 390x844, light and dark), seeds 103 and 2103.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/cathnivore-phone-hand-shots.mjs
// TAG=before|after names the files; OUT sets the folder. Prints each hand card's title fit.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATH_URL ?? 'http://localhost:4180/cathnivore/'
const out = process.env.OUT ?? 'e2e/screenshots/h164'
const tag = process.env.TAG ? `-${process.env.TAG}` : ''
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const scheme of ['light', 'dark']) {
  for (const seed of ['103', '2103']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, colorScheme: scheme })
    await page.goto(base)
    await page.getByText('Quick Game').click()
    await page.getByLabel('Seed (optional)').waitFor({ state: 'attached' })
    const adv = page.getByRole('button', { name: 'Advanced' })
    if (await adv.isVisible()) await adv.click()
    await page.getByLabel('Seed (optional)').fill(seed)
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('[data-hand-card]').first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/P-${scheme}-${seed}${tag}.png` })
    const fit = await page.evaluate(() =>
      [...document.querySelectorAll('[data-hand-card] .action-label')].map((el) => {
        const r = el.getBoundingClientRect()
        return `${el.textContent?.trim()} | ${Math.round(r.left)}-${Math.round(r.right)} | fs ${getComputedStyle(el).fontSize} | cut ${el.scrollWidth > el.clientWidth + 1 || r.right > innerWidth || r.left < 0}`
      }),
    )
    if (scheme === 'light') console.log(seed, '\n ' + fit.join('\n '))
    // A focused card rises: its top 200 ms after focus, against before.
    const rise = await page.evaluate(async () => {
      const card = [...document.querySelectorAll('[data-hand-card]')].find((c) => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth })
      if (!card) return null
      const y0 = card.getBoundingClientRect().top
      card.querySelector('button').focus({ preventScroll: true })
      await new Promise((r) => setTimeout(r, 200))
      return Math.round(y0 - card.getBoundingClientRect().top)
    })
    console.log(scheme, seed, 'rise', rise)
    await page.evaluate(() => document.activeElement?.blur())
    // The end of the hand: the 'Not yet' pile.
    await page.evaluate(() => { const a = document.querySelector('.action-tray .actions'); a.style.scrollBehavior = 'auto'; a.scrollLeft = a.scrollWidth })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${out}/P-${scheme}-${seed}-end${tag}.png` })
    await page.close()
  }
}
await browser.close()
