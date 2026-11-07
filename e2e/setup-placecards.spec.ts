import { expect, test } from '@playwright/test'

// Plan item 204: at D the Setup's left column is table objects: the week's market a printed flyer with its rule a
// stamped line, the mode two tent place cards (radios, 44 px+), the picked one upright and the other laid flat. No
// box in the column is a tall block of a few words (the old 243 px 'Solo with an AI' tile). Phones keep their chairs.
const open = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
}

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`Setup at ${width}x${height}: the flyer and the place cards`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the desktop spread')
    await page.setViewportSize({ width, height })
    await open(page)
    const cards = page.locator('[data-place-card]')
    await expect(cards).toHaveCount(2)
    for (const c of await cards.all()) {
      await expect(c.locator('input[type="radio"]')).toHaveCount(1)
      const b = (await c.boundingBox())!
      expect(b.height).toBeGreaterThanOrEqual(44)
      expect(b.width).toBeGreaterThanOrEqual(44)
      expect(b.height).toBeLessThanOrEqual(160)
    }
    const upright = (sel: string) => page.locator(sel).evaluate((el) => getComputedStyle(el).transform === 'none')
    expect(await upright('[data-place-card="solo"]')).toBe(true)
    expect(await upright('[data-place-card="hotseat"]')).toBe(false)
    // Plan item 259: the card laid flat still reads: its words foreshortened to 0.8 of their height or more (at 48 deg
    // 'Two at the table' read under 12 px).
    const squash = await page.locator('[data-place-card="hotseat"] .place-word').evaluate((el) => el.getBoundingClientRect().height / (el as HTMLElement).offsetHeight)
    expect(squash).toBeGreaterThanOrEqual(0.8)
    await page.locator('[data-place-card="hotseat"]').click()
    await expect(page.locator('[data-place-card="hotseat"] input')).toBeChecked()
    await expect.poll(() => upright('[data-place-card="hotseat"]')).toBe(true)
    await expect.poll(() => upright('[data-place-card="solo"]')).toBe(false)
    // The card's word is shown; the radio's own text stays for screen readers only.
    await expect(page.locator('[data-place-card="hotseat"] .place-word')).toBeVisible()
    // The flyer's rule is a stamp, and no box in the left column is a tall block of under six words.
    await expect(page.locator('.market-event[data-flyer] [data-stamp]')).toBeVisible()
    const tall = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.market-event, .market-event *, .setup-mode, .setup-mode *')]
        .filter((el) => el.getBoundingClientRect().height > 160 && (el.innerText ?? '').split(/\s+/).filter(Boolean).length < 6)
        .map((el) => el.className),
    )
    expect(tall).toEqual([])
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  })
}

test('phone Setup keeps its chairs: no place-card words', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the phone layout')
  await open(page)
  await expect(page.locator('[data-place-card] .place-word').first()).toBeHidden()
  await expect(page.locator('[data-place-card]')).toHaveCount(2)
})

test("desktop Setup: Cath's pin tin shows the pins earned and this week's", async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'the desktop spread')
  await page.addInitScript(() => localStorage.setItem('cath:pins', JSON.stringify(['bunting'])))
  await open(page)
  const tin = page.getByRole('group', { name: "Cath's market pins" })
  await expect(tin).toBeVisible()
  await expect(tin.locator('li')).toHaveCount(3)
  await expect(tin.locator('li[data-earned]')).toHaveCount(1)
  await expect(tin.locator('li[data-pin="bunting"]')).toContainText('Earned')
  await expect(tin.locator('li[data-week]')).toHaveCount(1)
  await expect(tin).toContainText('1 of 3')
  const b = (await tin.boundingBox())!
  expect(b.height).toBeLessThanOrEqual(200)
})
