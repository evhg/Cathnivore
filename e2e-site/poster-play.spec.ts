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
  if (page.viewportSize()!.width >= 1100) {
    // Plan item 715: until a print is pointed at, the wall tours: one plays at a time, in turn.
    await expect(playing(page)).toHaveCount(1, { timeout: 8000 })
    // Plan item 454: from the first point on, a print plays only while it is pointed at or focused.
    await page.locator('.show-b').hover()
    await expect(page.locator('.show-b')).toHaveAttribute('data-playing', 'runnel')
    await page.mouse.move(5, 880)
    await expect(playing(page)).toHaveCount(0)
    await page.locator('.show-d').focus()
    await expect(page.locator('.show-d')).toHaveAttribute('data-playing', 'hedgerow')
    return
  }
  await expect(playing(page)).toHaveCount(1, { timeout: 8000 })
  // On a phone the prints share one spot: the one playing is the one showing.
  const op = await playing(page).evaluate((el) => Number(getComputedStyle(el).opacity))
  expect(op).toBeGreaterThan(0.5)
  // Plan item 718: her bubble names the print playing, and follows the turn to the next one.
  const say = page.locator('#show-say')
  const first = await playing(page).getAttribute('data-playing')
  await expect(say).toHaveAttribute('data-names', first!)
  await expect(say.locator('.show-say-short')).toContainText(first === 'nightshift' ? 'NIGHT SHIFT' : first![0]!.toUpperCase() + first!.slice(1))
  await expect(say).not.toHaveAttribute('data-names', first!, { timeout: 9000 })
  await expect(say).toHaveAttribute('data-names', /^(cathnivore|runnel|hedgerow|nightshift)$/)
})

test("NIGHT SHIFT's phone print is a lit street, not a black tile", async ({ page }) => {
  test.skip(page.viewportSize()!.width > 720, 'the phone prints')
  await page.goto('/')
  const img = page.locator('.show-strip .show-c img')
  await img.scrollIntoViewIfNeeded()
  await expect(img).toHaveJSProperty('complete', true)
  // Plan item 718: mean relative luminance of the print as drawn (its neon spill included) 0.12+ (it read 0.10).
  const png = (await img.screenshot()).toString('base64')
  const lum = await page.evaluate(async (data) => {
    const im = new Image()
    im.src = `data:image/png;base64,${data}`
    await im.decode()
    const c = document.createElement('canvas')
    c.width = im.naturalWidth
    c.height = im.naturalHeight
    const g = c.getContext('2d')!
    g.drawImage(im, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    let sum = 0
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!)
    return sum / (d.length / 4)
  }, png)
  expect(lum).toBeGreaterThanOrEqual(0.12)
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
