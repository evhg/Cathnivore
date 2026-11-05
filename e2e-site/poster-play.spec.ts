import { test, expect, type Page } from '@playwright/test'

// Plan item 145: posters that play. One poster plays at a time (the hovered one, else each in view in turn),
// none plays off-screen, the loop waits for the page to load, and reduced motion keeps the stills.
const playing = (page: Page) => page.locator('[data-playing]')

test('one /games/ poster plays at a time, and a hovered one takes over', async ({ page }) => {
  await page.goto('/games/')
  await expect(playing(page)).toHaveCount(1, { timeout: 8000 })
  const first = await playing(page).getAttribute('data-playing')
  expect(['cathnivore', 'runnel', 'hedgerow', 'nightshift']).toContain(first)
  // Its loop canvas sits over the still, the size of the poster's art.
  const art = playing(page).locator('.hero-game-art')
  const canvas = art.locator('canvas.poster-loop')
  await expect(canvas).toHaveCount(1)
  const [a, c] = [(await art.boundingBox())!, (await canvas.boundingBox())!]
  expect(Math.abs(a.width - c.width)).toBeLessThan(2)
  expect(Math.abs(a.height - c.height)).toBeLessThan(2)
  // It draws something: the canvas isn't blank.
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => {
    const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++
    return n
  })).toBeGreaterThan(200)
  if (page.viewportSize()!.width >= 900) {
    const target = first === 'hedgerow' ? 'runnel' : 'hedgerow'
    await page.locator(`.hero-game-${target}`).hover()
    await expect(page.locator(`.hero-game-${target}`)).toHaveAttribute('data-playing', target)
    await expect(playing(page)).toHaveCount(1)
  }
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/poster-play-${test.info().project.name}.png` })
})

test('no poster plays off-screen', async ({ page }) => {
  await page.goto('/games/')
  await expect(playing(page)).toHaveCount(1, { timeout: 8000 })
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.mouse.move(1, 1)
  await expect(playing(page)).toHaveCount(0)
})

test('the portfolio prints play one at a time', async ({ page }) => {
  await page.goto('/')
  await expect(playing(page)).toHaveCount(1, { timeout: 8000 })
  // On a phone the prints share one spot: the one playing is the one showing.
  const op = await playing(page).evaluate((el) => Number(getComputedStyle(el).opacity))
  expect(op).toBeGreaterThan(0.5)
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('keeps the stills', async ({ page }) => {
    await page.goto('/games/')
    await page.waitForTimeout(3000)
    await expect(playing(page)).toHaveCount(0)
    await expect(page.locator('canvas.poster-loop')).toHaveCount(0)
  })
})

test('the loops rest when nobody is there, and wake on input', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/games/')
  await expect(playing(page)).toHaveCount(1, { timeout: 8000 })
  // 20 s after the last input (here, the page load) nothing plays.
  await expect(playing(page)).toHaveCount(0, { timeout: 26_000 })
  await page.mouse.move(30, 30)
  await page.mouse.move(40, 40)
  await expect(playing(page)).toHaveCount(1)
})
