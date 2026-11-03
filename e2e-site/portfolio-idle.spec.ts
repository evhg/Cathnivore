import { expect, test } from '@playwright/test'

// Critique bug (2026-11-03): the portfolio's WebGL field drew every frame forever, so the page never went
// CPU-idle (Lighthouse TTI/TBT failed). It now rests after 7 s without input and wakes on the next one.
test('the hero field rests when nobody is there, and wakes on input', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'a pointer wakes it; the rest is the same on a phone')
  await page.goto('/?field')
  const field = page.locator('#field')
  const running = () => field.getAttribute('data-running')
  // Without WebGL (some headless setups) the field never starts: nothing to check.
  test.skip((await running()) === null, 'no WebGL field')
  expect(await running()).toBe('true')
  await expect.poll(running, { timeout: 12_000 }).toBe('false')
  await page.mouse.move(400, 300)
  await page.mouse.move(420, 320)
  await expect.poll(running).toBe('true')
})
