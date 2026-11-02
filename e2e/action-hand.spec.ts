import { test, expect } from '@playwright/test'

// Plan item 21 (a hand of action cards): on a phone every action is a card in the dock under the board,
// reachable without scrolling the page, with no "n more" pill; and the game can be played from the
// keyboard alone. (SHOTS=1 saves the hand to e2e/screenshots.)
test('every action card is reachable at P without scrolling the page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('input[inputmode="numeric"]').fill('1')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const items = page.locator('.action-tray .actions .action-item')
  const n = await items.count()
  expect(n).toBeGreaterThan(5)
  const vh = page.viewportSize()!.height
  for (let i = 0; i < n; i++) {
    const button = items.nth(i).locator('button').first()
    await button.evaluate((b) => b.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
    const box = (await button.boundingBox())!
    expect(box.y, `card ${i} top`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, `card ${i} bottom`).toBeLessThanOrEqual(vh)
    expect(await page.evaluate(() => window.scrollY + (document.scrollingElement?.scrollTop ?? 0))).toBe(0)
  }
  // The dock never needs the vertical "n more" pill.
  expect(await page.locator('.actions-well[data-more]').count()).toBe(0)
  await page.locator('.action-tray .actions').evaluate((el) => el.scrollTo({ left: 0 }))
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/hand-${testInfo.project.name}.png` })
})

test('keyboard-only play completes a round', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('input[inputmode="numeric"]').fill('1')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  const round = () => page.locator('svg.map[data-round]').first().getAttribute('data-round')
  expect(await round()).toBe('1')

  // Tab to a Sell or Graft card and press Enter, three times (one producer's actions for the round).
  for (let k = 0; k < 3; k++) {
    let found = false
    for (let t = 0; t < 80 && !found; t++) {
      await page.keyboard.press('Tab')
      found = await page.evaluate(() => {
        const el = document.activeElement as HTMLButtonElement | null
        const name = el?.getAttribute('aria-label') ?? el?.textContent ?? ''
        return !!el && el.tagName === 'BUTTON' && !el.disabled && !!el.closest('.actions') && /^(Graft|Sell)/.test(name.trim())
      })
    }
    expect(found, `found a Sell or Graft card for action ${k + 1}`).toBe(true)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(150)
  }
  // The AI teammate takes its turn, the corporations move, and round 2 begins.
  await expect.poll(round, { timeout: 30_000 }).toBe('2')
})

test('a region card dragged onto a glowing hex plays there', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'mouse drag')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('input[inputmode="numeric"]').fill('1')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const card = page.locator('.actions .action-card-draggable').first()
  await card.scrollIntoViewIfNeeded()
  const pipsOn = () => page.locator('.active-producer .pip.on').count()
  const before = await pipsOn()
  const from = (await card.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 30, from.y + from.height / 2 - 30, { steps: 4 })
  await expect(page.locator('.drag-ghost')).toBeVisible()
  const target = page.locator('.region-hex.glow').first()
  await expect(target).toBeVisible()
  const t = (await target.locator('polygon').first().boundingBox())!
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/hand-drag-${testInfo.project.name}.png` })
  await page.mouse.up()
  await expect(page.locator('.drag-ghost')).toHaveCount(0)
  await expect.poll(pipsOn).toBe(before - 1)
})
