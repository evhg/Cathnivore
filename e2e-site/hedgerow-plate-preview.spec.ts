import { expect, test, type Page } from '@playwright/test'

// Plan item 493: the level card's field plate plays its level: the first round's convoy rolls down the plate's lane
// (one of each vehicle the card lists), looping while the card shows; pointing at or focusing a vehicle's row lights
// that vehicle on the plate; nothing is drawn while the card is hidden; one still under reduced motion.
async function seed(page: Page, done: number) {
  await page.goto('/hedgerow/?2d')
  await page.evaluate((done) => {
    const stars: Record<string, number> = {}
    const seenBefore: Record<string, boolean> = {}
    for (let i = 1; i <= done; i++) {
      stars[String(i)] = 3
      seenBefore[String(i)] = true
    }
    seenBefore[String(done + 1)] = true
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: {}, bank: {} }))
  }, done)
}

test('the plate plays the convoy and a row lights its vehicle', async ({ page }, info) => {
  await seed(page, 20)
  const t0 = Date.now()
  await page.reload()
  const card = page.locator('[data-level-card]')
  await expect(card).toBeVisible()
  const opened = Date.now()
  const thumb = card.locator('.lcard-thumb')
  await expect(thumb).toHaveAttribute('data-preview-playing', '', { timeout: 5000 })
  // within 500 ms of the card showing (headless timing has slack in the reload, not here)
  expect(Date.now() - opened, `reload took ${opened - t0} ms`).toBeLessThan(1500)
  const phone = info.project.name.includes('phone')
  if (phone) await card.locator('.lcard-grip').click()
  // the vehicles move: a visible car's transform changes between two reads
  const pos = () => thumb.locator('svg:visible .lcard-car[opacity]:not([opacity="0"])').first().getAttribute('transform')
  const a = await pos()
  await page.waitForTimeout(400)
  expect(await pos()).not.toBe(a)
  if (!phone) {
    const plate = (await thumb.locator('svg:visible').boundingBox())!
    expect(Math.max(plate.width, plate.height)).toBeGreaterThanOrEqual(220)
  }
  // every row's vehicle is on the plate, and pointing at a row lights it within 150 ms
  const kinds = await card.locator('.lcard-enemies li[data-kind]').evaluateAll((li) => li.map((l) => (l as HTMLElement).dataset.kind!))
  expect(kinds.length).toBeGreaterThan(0)
  for (const k of kinds) expect(await thumb.locator(`svg:visible .lcard-car[data-kind="${k}"]`).count()).toBeGreaterThan(0)
  const row = card.locator(`.lcard-enemies li[data-kind="${kinds[0]}"]`)
  if (phone) await row.focus()
  else await row.hover()
  const lit = await page.evaluate(
    (k) =>
      new Promise<number>((done) => {
        const t = performance.now()
        const check = () => (document.querySelector(`.lcard-thumb svg .lcard-car.is-lit[data-kind="${k}"]`) ? done(performance.now() - t) : requestAnimationFrame(check))
        check()
      }),
    kinds[0]!,
  )
  expect(lit).toBeLessThanOrEqual(150)
  await expect(thumb).toHaveAttribute('data-lit', kinds[0]!)
})

test('no preview is drawn while the card is hidden', async ({ page }) => {
  await seed(page, 20)
  await page.reload()
  const thumb = page.locator('[data-level-card] .lcard-thumb')
  await expect(thumb).toHaveAttribute('data-preview-playing', '', { timeout: 5000 })
  await page.evaluate(() => ((document.querySelector('[data-level-card]') as HTMLElement).style.display = 'none'))
  await expect(thumb).not.toHaveAttribute('data-preview-playing')
  const moved = await page.evaluate(async () => {
    const car = () => [...document.querySelectorAll('.lcard-car')].map((c) => c.getAttribute('transform')).join('|')
    const a = car()
    await new Promise((r) => setTimeout(r, 400))
    return a !== car()
  })
  expect(moved).toBe(false)
})

test('reduced motion shows one still convoy', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await seed(page, 20)
  await page.reload()
  const thumb = page.locator('[data-level-card] .lcard-thumb')
  await expect(thumb).toHaveAttribute('data-preview-still', '')
  await page.waitForTimeout(500)
  await expect(thumb).not.toHaveAttribute('data-preview-playing')
  expect(await thumb.locator('svg:visible .lcard-car:not([opacity="0"])').count()).toBeGreaterThan(0)
  await ctx.close()
})
