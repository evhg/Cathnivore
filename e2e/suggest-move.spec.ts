import { test, expect } from '@playwright/test'

// Plan item 141: on Normal Cath marks one card, the move she'd play, and says why; Settings turns it off.
test('Cath suggests exactly one move in round 1, and the Settings toggle hides it', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()
  await expect(page.locator(':is(.actions, .table-hand) [data-suggested]')).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator(':is(.actions, .table-hand) [data-suggested] .suggest-leaf')).toHaveCount(1)
  await expect(page.getByTestId('suggest-line')).toContainText('Cath:')
  if (testInfo.project.name === 'phone') {
    // The strip scrolls sideways: the leafed card is brought onto it.
    await expect
      .poll(() =>
        page.locator('.action-tray .actions [data-suggested]').evaluate((el) => {
          let strip = el.parentElement
          while (strip && strip.scrollWidth <= strip.clientWidth + 1) strip = strip.parentElement
          if (!strip) return true
          const s = strip.getBoundingClientRect()
          const r = el.getBoundingClientRect()
          return r.left >= s.left - 1 && r.right <= s.right + 1
        }),
      )
      .toBe(true)
  }
  // Turn it off the way Settings stores it, then reload the saved game.
  await page.evaluate(() => {
    const key = 'cathnivore:settings:v1'
    const raw = localStorage.getItem(key)
    const s = raw ? JSON.parse(raw) : { version: 1 }
    localStorage.setItem(key, JSON.stringify({ ...s, version: 1, suggestions: false }))
  })
  await page.reload()
  const resume = page.getByRole('button', { name: /Continue|Resume/ })
  if (await resume.first().isVisible().catch(() => false)) await resume.first().click()
  await expect(page.locator('.game')).toBeVisible()
  await expect(page.locator(':is(.actions, .table-hand) .action-item').first()).toBeVisible()
  await expect(page.locator(':is(.actions, .table-hand) [data-suggested]')).toHaveCount(0)
  await expect(page.getByTestId('suggest-line')).toHaveCount(0)
})

test('looking at Open Stall puts a ghost piece on the board and its cost on the ledger', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()
  await page.mouse.move(0, 0) // plan item 149: a desktop hand card under the resting pointer previews itself
  const stall = page.locator(':is(.actions, .table-hand) .action-item').filter({ hasText: 'Open Stall' }).first()
  await expect(stall).toBeAttached({ timeout: 10_000 })
  await expect(page.locator('.ghost-piece')).toHaveCount(0)
  // Keyboard focus previews (a tap's focus doesn't), so the phone run tabs in.
  if (testInfo.project.name === 'phone') {
    await page.keyboard.press('Shift')
    await stall.locator('button').first().focus()
  }
  else await stall.hover()
  await expect(page.locator('.map .ghost-piece').first()).toBeAttached()
  await expect(page.locator('.ledger-chip[data-delta="-1"]').first()).toBeAttached()
  // The preview stays out of the ledger's text.
  await expect(page.locator('.ledger-chip[data-delta="-1"]').first()).not.toContainText('\u2212')
  if (testInfo.project.name === 'phone') await stall.locator('button').first().blur()
  else await page.mouse.move(0, 0)
  await expect(page.locator('.ghost-piece')).toHaveCount(0)
})
