import { expect, test } from '@playwright/test'

// Plan item 151: people live in the valley. A farmer, Bea, two sheep and the cart walk its margins, each walk
// clear of the tiles, Cath, the garden, the spring house and the week's keeps; water on a field marks it tended and
// sets the farmer working; a solve makes the valley cheer.
test('four or more folk walk the valley, clear of everything; a solve tends the fields and they cheer', async ({ page }) => {
  await page.goto('/runnel/?nohelp&practice')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.waitForTimeout(400)
  const shown = page.locator('[data-valley-folk]:not([hidden])')
  expect(await shown.count()).toBeGreaterThanOrEqual(4)
  const clash = await page.evaluate(() => {
    const blocks = [
      ...document.querySelectorAll('#board polygon.tile, #valley-cath:not([hidden]), .bea-garden, .spring-house, .farm-sign, .valley-feature:not([hidden])'),
    ]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0)
    const folk = [...document.querySelectorAll<HTMLElement>('[data-valley-folk]:not([hidden])')].map((f) => {
      // Its whole walk: the standing box widened by its range either side (the pace is a translate).
      const range = parseFloat(f.style.getPropertyValue('--range')) || 0
      const left = f.offsetLeft - range
      const st = f.offsetParent!.getBoundingClientRect()
      return new DOMRect(st.left + left, st.top + f.offsetTop, f.offsetWidth + 2 * range, f.offsetHeight)
    })
    const meets = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
    return folk.some((f, i) => blocks.some((b) => meets(f, b)) || folk.some((g, j) => j !== i && meets(f, g)))
  })
  expect(clash).toBe(false)

  // Water to the fields: each watered field is tended, the farmer works, and the solve makes everyone cheer.
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  await page.locator('#board [data-last]').click()
  await expect(page.locator('#valley-folk')).toHaveAttribute('data-cheer', '', { timeout: 5_000 })
  await expect(page.locator('#valley-folk')).toHaveAttribute('data-working', '')
  const fields = page.locator('#board .tiles > g.cell.field')
  const n = await fields.count()
  expect(n).toBeGreaterThan(0)
  await expect(page.locator('#board .tiles > g.cell.field[data-tended]')).toHaveCount(n, { timeout: 3_000 })
  // One Bea: her walking self steps out as she runs to the garden.
  await expect(page.locator('[data-valley-folk="bea"]')).toHaveCSS('opacity', '0', { timeout: 3_000 })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('the folk stand still', async ({ page }) => {
    await page.goto('/runnel/?nohelp&practice')
    await page.waitForSelector('#board .tiles > g.cell')
    const anim = await page.locator('[data-valley-folk]:not([hidden])').first().evaluate((e) => getComputedStyle(e).animationName)
    expect(anim).toBe('none')
  })
})
