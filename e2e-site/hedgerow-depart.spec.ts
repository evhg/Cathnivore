import { expect, test, type Page } from '@playwright/test'

// Plan item 448: Play on the act map's level card is a departure, not a cut: the card's field plate lifts at once
// (the first change within 100 ms of the tap), grows over the screen while the field opens under it, and fades into
// it, about 0.7-1.1 s in all; under reduced motion the field simply opens.
async function open(page: Page, q: string) {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i <= 20; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '21': true }, tips: { all: true } }))
  })
  await page.goto(`/hedgerow/?2d${q}`)
  await page.locator('.lcard-play').first().waitFor()
  await page.waitForTimeout(800)
}

test('Play lifts the field plate at once and lands in the field in about a second', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one check is enough: the departure is the same at P')
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, '&depart')
  await page.evaluate(() => {
    const w = window as unknown as { dep: { click: number; ghost: number; gone: number } }
    w.dep = { click: 0, ghost: 0, gone: 0 }
    document.querySelector('.lcard-play')!.addEventListener('click', () => (w.dep.click = performance.now()), { capture: true, once: true })
    new MutationObserver(() => {
      const g = document.querySelector('.lcard-depart')
      if (g && !w.dep.ghost) w.dep.ghost = performance.now()
      if (!g && w.dep.ghost && !w.dep.gone) w.dep.gone = performance.now()
    }).observe(document.body, { childList: true })
  })
  await page.locator('.lcard-play').first().click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { dep: { gone: number } }).dep.gone), { timeout: 5_000 }).toBeGreaterThan(0)
  const d = await page.evaluate(() => (window as unknown as { dep: { click: number; ghost: number; gone: number } }).dep)
  const s = JSON.stringify(d)
  expect(d.ghost - d.click, s).toBeLessThan(100)
  expect(d.gone - d.click, s).toBeGreaterThanOrEqual(700)
  // The plate fades only once the field has painted, and headless software rendering builds and paints the field
  // slowly (about 2.6 s end to end here), so the far bound has slack over the 1.1 s aim.
  expect(d.gone - d.click, s).toBeLessThan(4_500)
  await expect(page.locator('#screen-play')).toBeVisible()
})

test('under reduced motion Play opens the field with no flight', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one check is enough')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '&depart')
  await page.locator('.lcard-play').first().click()
  await expect(page.locator('.lcard-depart')).toHaveCount(0)
  await expect(page.locator('#screen-play')).toBeVisible()
})
