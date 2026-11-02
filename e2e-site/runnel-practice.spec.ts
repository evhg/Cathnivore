import { expect, test } from '@playwright/test'

// Plan item 39: Practice is one screen (the board under one "Board" chip whose sheet holds size, codes, picks and
// the workshop), and the first-visit lesson hides the stats rail.

const tileBox = () => {
  const boxes = [...document.querySelectorAll('#board .tile')].map((t) => t.getBoundingClientRect())
  return {
    top: Math.min(...boxes.map((b) => b.top)),
    width: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left)),
  }
}

test.describe('Runnel Practice on one screen (plan item 39)', () => {
  test('at 390x844 the Practice board starts within 260 px of the top and fills 85% of the width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/runnel/?nohelp&mode=practice')
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    await expect(page.locator('#btn-board')).toBeVisible()
    await expect(page.locator('#sizes')).toBeHidden()
    await expect(page.locator('#code-input')).toBeHidden()
    const svgTop = await page.locator('#board').evaluate((b) => b.getBoundingClientRect().top)
    expect(svgTop).toBeLessThanOrEqual(260)
    const r = await page.evaluate(tileBox)
    expect(r.width / 390).toBeGreaterThanOrEqual(0.85)
    // Nothing scrolls sideways or down: the screen holds the whole board and its buttons.
    const over = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }))
    expect(over.x).toBeLessThanOrEqual(0)
    expect(over.y).toBeLessThanOrEqual(0)
  })

  test('the Board chip opens a sheet: a size change closes it and plays that size', async ({ page }) => {
    await page.goto('/runnel/?nohelp&mode=practice')
    await expect(page.locator('#board-chip-label')).toHaveText('Medium')
    const medium = await page.locator('.tiles > g.cell').count()
    await page.locator('#btn-board').click()
    await expect(page.locator('#board-sheet')).toBeVisible()
    await page.locator('#board-sheet').getByRole('button', { name: 'Large' }).click()
    await expect(page.locator('#board-sheet')).toBeHidden()
    await expect(page.locator('#board-chip-label')).toHaveText('Large')
    expect(await page.locator('.tiles > g.cell').count()).toBeGreaterThan(medium)
    await page.locator('#btn-board').click()
    await page.locator('#board-sheet-close').click()
    await expect(page.locator('#board-sheet')).toBeHidden()
  })

  test('the chip only shows in Practice', async ({ page }) => {
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('#btn-board')).toBeHidden()
    await page.getByRole('tab', { name: 'Practice' }).click()
    await expect(page.locator('#btn-board')).toBeVisible()
    await page.getByRole('tab', { name: 'Orchard' }).click()
    await expect(page.locator('#btn-board')).toBeHidden()
  })

  test('the stats rail is hidden during the lesson at 1440', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'the rail is a desktop layout')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/runnel/?lesson')
    await expect(page.locator('body.in-lesson')).toHaveCount(1)
    await expect(page.locator('#rail')).toBeHidden()
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('#rail')).toBeVisible()
  })
})
