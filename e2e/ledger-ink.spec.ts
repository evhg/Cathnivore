import { expect, test } from '@playwright/test'

// Plan item 244: the desktop rail's ledger writes itself: a line per move in order, each with its Marks change and the
// running Marks, which meets the Marks on the producer's mat; a round's end writes a closing line with Bea's doodle.
test('the ledger writes a line per move, and its Marks column meets the mat', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'desktop rail only')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const lines = page.locator('.actions-sheet .round-ledger .receipt[data-kind="action"]')
  await expect(page.locator('.actions-sheet .round-ledger .receipt[data-kind="opening"]')).toBeVisible()
  const matMarks = () =>
    page.evaluate(() => {
      const chip = [...document.querySelectorAll('.ledger-chip')].find((c) => /Marks,/.test(c.textContent ?? ''))
      return Number(chip?.querySelector('.ledger-value')?.textContent)
    })
  const moves = [/^Sell 1 Produce/, /^Graft/, /^Sell 1 Produce/]
  const want = ['Sold 1 Produce', 'Grafted', 'Sold 1 Produce']
  for (const [i, name] of moves.entries()) {
    await page.getByRole('button', { name }).first().click()
    await expect(lines).toHaveCount(i + 1, { timeout: 15_000 })
    if (i < 2) expect(Number(await lines.nth(i).getAttribute('data-marks'))).toBe(await matMarks())
    if (i === 0) {
      // Each line is a 22 px ruled line in the ink hand, 12 px or larger.
      const cs = await lines.first().evaluate((e) => {
        const s = getComputedStyle(e)
        return { h: e.getBoundingClientRect().height, font: parseFloat(s.fontSize), italic: s.fontStyle }
      })
      expect(cs.h).toBe(22)
      expect(cs.font).toBeGreaterThanOrEqual(12)
      expect(cs.italic).toBe('italic')
    }
  }
  expect((await lines.locator('.receipt-why').allTextContents()).map((t) => t.trim())).toEqual(want)
  // The third move ends the round: Hollowell's turn, a closing line with a doodle, and the Harvest on the page.
  await expect(page.locator('.actions-sheet .round-ledger .receipt[data-kind="round"] .receipt-doodle')).toHaveCount(1, { timeout: 60_000 })
  const last = page.locator('.actions-sheet .round-ledger .receipt[data-producer="mara"]').last()
  await expect.poll(async () => Number(await last.getAttribute('data-marks')) === (await matMarks()), { timeout: 30_000 }).toBe(true)
})
