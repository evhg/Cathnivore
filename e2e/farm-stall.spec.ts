import { test, expect } from '@playwright/test'

// Plan item 62: the farm as a stall that fills up. By round 5 of an autoplayed game each producer's stall holds one
// crate per Improvement bought: on a phone in the Farm sheet (one crate per card listed under it), on a desktop in
// the left column; the phone page doesn't scroll.
test('the farm stall holds a crate per Improvement', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=5')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForFunction(() => Number(document.querySelector('svg.map[data-round]')?.getAttribute('data-round') ?? 0) >= 5, null, { timeout: 90_000 })
  await page.waitForTimeout(1500)
  if (testInfo.project.name === 'phone') {
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: /^Farm/ }).first().click()
    const sheet = page.getByRole('dialog', { name: 'Farm' })
    await expect(sheet).toBeVisible()
    for (const col of await sheet.locator('.farm-column').all()) {
      const cards = await col.locator('.farmstead-card').count()
      await expect(col.locator('.stall-item')).toHaveCount(cards)
    }
    expect(await sheet.locator('.stall-item').count()).toBeGreaterThan(0)
  } else {
    const stalls = page.locator('.farm-inline .farm-stall')
    for (const s of await stalls.all()) {
      const n = Number(await s.getAttribute('data-items'))
      await expect(s.locator('.stall-item')).toHaveCount(n)
    }
  }
})
