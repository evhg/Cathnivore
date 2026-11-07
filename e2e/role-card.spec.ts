import { test, expect } from '@playwright/test'

// Plan item 225: the Role card's window is the producer's own ability and its foot says it's free; on a desktop
// with the hand on the table the rail's shelf is 'Saving for' and its ledger is a ruled page that runs down to Undo.
test("the Role card shows its producer's scene and a Free foot", async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()
  const role = page.locator(':is(.actions, .table-hand) .action-item:has([data-art="role"])').first()
  await expect(role).toBeAttached({ timeout: 10_000 })
  // Quick Game seats Mara first: her injunction notice, not the generic rosette.
  await expect(role.locator('[data-role-scene="mara"]')).toHaveCount(1)
  await expect(role.locator('.action-free')).toHaveText(/free/i)
  await expect(role.locator('.action-free')).toBeVisible()
})

test('the desktop rail: a Saving for shelf and a ledger page down to Undo', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the hand sits on the table on a desktop only')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.table-hand')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.actions-sheet .frame-title')).toHaveCount(0)
  await expect(page.locator('.actions-sheet .action-head-later')).toHaveText('Saving for')
  const gap = await page.evaluate(() => {
    const roll = document.querySelector('.actions-sheet .round-ledger-roll')!.getBoundingClientRect()
    const u = document.querySelector('.actions-sheet .rail-undo')!.getBoundingClientRect()
    return u.top - roll.bottom
  })
  expect(gap).toBeLessThanOrEqual(24)
  // The partner's name is light lettering on the wood in both themes.
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    const color = await page.locator('.desktop-col-left .partner-mat-name, .partner-mat-name').first().evaluate((el) => getComputedStyle(el).color)
    const [r, g, b] = color.match(/\d+/g)!.map(Number)
    expect(0.2126 * r! + 0.7152 * g! + 0.0722 * b!).toBeGreaterThan(180)
  }
})
