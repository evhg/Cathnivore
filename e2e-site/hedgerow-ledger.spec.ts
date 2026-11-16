import { expect, test } from '@playwright/test'

// Plan item 460: at D everything under the seed rack is one ledger page (the round, Cath's tip, the tabs, the rounds
// ahead), parted by ruled lines: apart from the seed packets themselves, no box 60 px or wider in the panel wears a
// border or a ring (it held some 25 bordered boxes); the open tab is underlined, and the locks row reads in words.
test('level 21 at D: the panel under the rack is a ruled ledger, not boxes', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 900, 'desktop panel')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 21: true } })))
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  await expect(page.locator('.tray-tower').first()).toBeVisible()
  await page.waitForTimeout(800)
  const boxed = await page.evaluate(() => {
    const panel = document.querySelector('.play .panel')!
    const out: string[] = []
    for (const e of panel.querySelectorAll<HTMLElement>('*')) {
      // the packets are the rack's items, and her portrait's ring frames a face, not a box of content
      if (e.closest('.tray-tower') || e.matches('.cath-plate-face')) continue
      const r = e.getBoundingClientRect()
      if (r.width < 60 || r.height < 24) continue
      const cs = getComputedStyle(e)
      const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((s) => parseFloat(cs.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 && cs.getPropertyValue(`border-${s.toLowerCase()}-style`) !== 'none')
      const ring = /0px 0px 0px [1-9]/.test(cs.boxShadow)
      // a ruled line is one or two sides; a box is all four, or a ring
      if (sides.length >= 3 || ring) out.push(`${e.className}`)
    }
    return out
  })
  expect(boxed).toEqual([])
  const open = page.locator('.field-tab[aria-selected="true"]')
  expect(parseFloat(await open.evaluate((e) => getComputedStyle(e).borderBottomWidth))).toBeGreaterThanOrEqual(2)
  await expect(page.locator('.intel-locks .intel-label')).toHaveText(/^(Not covered|Every trait covered)$/)
})
