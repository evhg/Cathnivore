import { expect, test } from '@playwright/test'

// Plan item 174: the level card as a seed-catalogue page: a painted plate of the field, one portrait (40 px or
// more) per vehicle with its threat line, and Cath's line. At D it meets no map stop; on a phone it's a bottom
// sheet that peeks the name and Play and pulls up for the rest.
test('the level card is a catalogue page, clear of the map stops', async ({ page }, info) => {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    const seenBefore: Record<string, boolean> = {}
    for (let i = 1; i <= 13; i++) {
      stars[String(i)] = 3
      seenBefore[String(i)] = true
    }
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: {}, bank: {} }))
  })
  await page.reload()
  const card = page.locator('[data-level-card]')
  await expect(card).toBeVisible()
  const phone = info.project.name.includes('phone')
  if (phone) {
    // Peek: the name and Play only.
    await expect(card.locator('.lcard-name')).toBeVisible()
    await expect(card.locator('.lcard-play')).toBeVisible()
    await expect(card.locator('.lcard-enemies')).toBeHidden()
    expect((await card.boundingBox())!.height).toBeLessThanOrEqual(110)
    await card.locator('.lcard-grip').click()
    await expect(card).toHaveClass(/open/)
  }
  const kinds = await card.locator('.lcard-enemies li').evaluateAll((li) => li.map((l) => (l as HTMLElement).dataset.kind))
  expect(kinds.length).toBeGreaterThanOrEqual(1)
  expect(new Set(kinds).size).toBe(kinds.length)
  const portraits = card.locator('.enemy-portrait')
  await expect(portraits).toHaveCount(kinds.length)
  for (const p of await portraits.all()) {
    const b = (await p.boundingBox())!
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(40)
  }
  for (const t of await card.locator('.lcard-foe span').all()) await expect(t).not.toBeEmpty()
  // Plan item 200: the threat lines read at 13 px or more (they were 12 px, about 11 in the critique's shot).
  for (const t of await card.locator('.lcard-foe span').all()) expect(await t.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(13)
  // And on a phone the tab bar's labels under it are at the 12 px floor (they were 11.5 px).
  if (phone) for (const t of await page.locator('#screen-select .top-tools .bank-word').all()) if (await t.isVisible()) expect(await t.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12)
  await expect(card.locator('[data-cath-line] p')).not.toBeEmpty()
  await expect(card.locator('.lcard-thumb svg')).toBeVisible()
  if (!phone) {
    const met = await page.evaluate(() => {
      const c = document.querySelector('[data-level-card]')!.getBoundingClientRect()
      return [...document.querySelectorAll('button.node')].some((n) => {
        const r = n.getBoundingClientRect()
        return r.width > 0 && r.left < c.right && c.left < r.right && r.top < c.bottom && c.top < r.bottom
      })
    })
    expect(met).toBe(false)
  }
})
