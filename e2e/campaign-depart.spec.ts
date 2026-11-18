import { expect, test, type Page } from '@playwright/test'

// Plan item 483: starting a chapter is a staged departure, not a cut. The chapter's homes glow at once (the first
// change within 100 ms of the tap), the atlas zooms in on them and Cath steps toward them, and the screen gives
// way to the chapter's story scene 0.7-1.1 s after the tap. A tap skips it; reduced motion keeps a short fade.
// Under webdriver the departure is off unless the page has `?depart`, so other specs click straight through.
async function open(page: Page) {
  await page.goto('/?depart')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.locator('.cmp-map-svg').waitFor()
  await page.waitForTimeout(600)
}

async function timeIt(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { dep: { click: number; mark: number; gone: number } }
    w.dep = { click: 0, mark: 0, gone: 0 }
    const card = document.querySelector('.cmp-stop-next .cmp-card')!
    card.addEventListener('click', () => (w.dep.click = performance.now()), { capture: true, once: true })
    new MutationObserver(() => {
      const main = document.querySelector('.campaign-screen')
      if (main?.hasAttribute('data-departing') && !w.dep.mark) w.dep.mark = performance.now()
      if (!main && w.dep.click && !w.dep.gone) w.dep.gone = performance.now()
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-departing'] })
  })
}

const dep = (page: Page) => page.evaluate(() => (window as unknown as { dep: { click: number; mark: number; gone: number } }).dep)

test('Start glows the homes at once and opens the chapter in about a second', async ({ page }) => {
  await open(page)
  await timeIt(page)
  await page.locator('.cmp-stop-next .cmp-card').click()
  await expect(page.locator('.cmp-map-hex.is-departing').first()).toBeAttached()
  expect(await page.locator('.cmp-map-svg').evaluate((e) => getComputedStyle(e).animationName)).toBe('cmp-depart-zoom')
  await expect.poll(async () => (await dep(page)).gone, { timeout: 5_000 }).toBeGreaterThan(0)
  const d = await dep(page)
  const s = JSON.stringify(d)
  expect(d.mark - d.click, s).toBeLessThan(100)
  expect(d.gone - d.click, s).toBeGreaterThanOrEqual(700)
  expect(d.gone - d.click, s).toBeLessThan(1_400)
  await expect(page.locator('.scene')).toBeVisible()
})

test('a tap skips the departure', async ({ page }) => {
  await open(page)
  await timeIt(page)
  await page.locator('.cmp-stop-next .cmp-card').click()
  await expect(page.locator('.cmp-depart-skip')).toBeAttached()
  await page.mouse.click(20, 20)
  await expect.poll(async () => (await dep(page)).gone, { timeout: 2_000 }).toBeGreaterThan(0)
  const d = await dep(page)
  expect(d.gone - d.click, JSON.stringify(d)).toBeLessThan(700)
  await expect(page.locator('.scene')).toBeVisible()
})

test('under reduced motion Start fades straight into the chapter', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await timeIt(page)
  await page.locator('.cmp-stop-next .cmp-card').click()
  expect(await page.locator('.cmp-map-svg').evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
  await expect.poll(async () => (await dep(page)).gone, { timeout: 2_000 }).toBeGreaterThan(0)
  const d = await dep(page)
  expect(d.gone - d.click, JSON.stringify(d)).toBeLessThan(600)
  await expect(page.locator('.scene')).toBeVisible()
})
