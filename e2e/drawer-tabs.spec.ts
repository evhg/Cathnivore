import { expect, test } from '@playwright/test'

// Plan item 366 slice 1: at D the right rail is a chest of drawers: each key a wooden drawer front with a brass pull,
// its word 13 px or more; a count is a round stamp; an opened drawer slides out toward the table.
test('desktop drawer keys are drawer fronts with 13 px+ words', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'the desktop rail')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  const keys = page.locator('.drawer-key')
  expect(await keys.count()).toBeGreaterThanOrEqual(2)
  for (const k of await keys.all()) {
    const m = await k.evaluate((el) => {
      const w = el.querySelector('.drawer-key-word')!
      const pull = getComputedStyle(el, '::before')
      return { size: parseFloat(getComputedStyle(w).fontSize), pull: pull.content !== 'none' && parseFloat(pull.width) > 10, overflow: w.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.5 }
    })
    expect(m.size).toBeGreaterThanOrEqual(13)
    expect(m.pull).toBe(true)
    expect(m.overflow).toBe(false)
  }
  const count = page.locator('.drawer-key-count').first()
  if (await count.count()) expect(await count.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('50%')
  await keys.first().click()
  await expect(keys.first()).toHaveClass(/is-open/)
  expect(await keys.first().evaluate((el) => getComputedStyle(el).translate)).toContain('-6px')
})
