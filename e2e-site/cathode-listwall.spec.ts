import { expect, test, type Page } from '@playwright/test'

// Plan item 169: at D The List is a living case wall: every print carries a rumour in Cath's hand (12 px or more) and
// its own district, red string runs from the other four prints to the open case, a hovered print comes forward
// (1.08 or more) with a typed note, and under reduced motion nothing moves.
type Front = { cathodeFront?: { ready: boolean } }

async function openTitle(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
}

const scaleOf = (page: Page, i: number) =>
  page.locator('#the-list-wall .mug').nth(i).evaluate((e) => {
    const s = getComputedStyle(e).scale
    return s === 'none' ? 1 : parseFloat(s)
  })

test('The List is a living case wall', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop wall')
  test.setTimeout(240_000)
  await openTitle(page)
  const mugs = page.locator('#the-list-wall .mug')
  await expect(mugs).toHaveCount(5)
  const prints = await mugs.evaluateAll((els) =>
    els.map((e) => {
      const r = e.querySelector<HTMLElement>('.rumour')
      return { district: e.getAttribute('data-district'), rumour: r?.textContent?.trim() ?? '', size: r ? parseFloat(getComputedStyle(r).fontSize) : 0, shown: !!r && r.getBoundingClientRect().height > 0 }
    }),
  )
  for (const p of prints) {
    expect(p.rumour.length, JSON.stringify(p)).toBeGreaterThan(0)
    expect(p.size).toBeGreaterThanOrEqual(12)
    expect(p.shown).toBe(true)
  }
  expect(new Set(prints.map((p) => p.district)).size).toBe(5)
  await expect(page.locator('#the-list-wall .list-string path')).toHaveCount(4)
  // Every string ends at the open case's pin.
  await expect(page.locator('#the-list-wall .mug[data-open]')).toHaveCount(1)

  const third = mugs.nth(2)
  await third.hover()
  await expect.poll(() => scaleOf(page, 2)).toBeGreaterThanOrEqual(1.08)
  await expect(third.locator('.mug-note')).toHaveCSS('opacity', '1')
  await expect(third.locator('.mug-note-type')).toHaveText(/HOLLOWELL PLAZA/)
  // Focus does the same (a print is a tab stop with its whole file as its name).
  await page.mouse.move(5, 5)
  await mugs.nth(4).focus()
  await expect.poll(() => scaleOf(page, 4)).toBeGreaterThanOrEqual(1.08)
  await expect(mugs.nth(4)).toHaveAttribute('aria-label', /THE HOLLOW VAULT.*listening/)
})

test('under reduced motion the List wall does not move', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop wall')
  test.setTimeout(240_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openTitle(page)
  const mug = page.locator('#the-list-wall .mug').nth(2)
  await mug.hover()
  await page.waitForTimeout(400)
  expect(await scaleOf(page, 2)).toBe(1)
  await expect(mug.locator('.mug-note')).toHaveCSS('opacity', '1')
})
