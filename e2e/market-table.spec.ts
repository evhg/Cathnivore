import { test, expect, type Page } from '@playwright/test'

// Plan item 28: the market table where the day passes. The table's light token moves from dawn (round 1)
// towards dusk. The autoplay stops at the round asked for; SHOTS=1 saves the table at rounds 1, 5 and 10
// (or the last round a game reaches) to e2e/screenshots.
async function tableAt(page: Page, round: number): Promise<number> {
  await page.goto(`/?e2eAutoplay=1&e2eAutoplayUntil=${round}`)
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const at = () => page.evaluate(() => Number(document.querySelector<SVGSVGElement>('.map-wrap svg.map[data-round]')?.dataset.round ?? 0))
  await expect.poll(at, { timeout: 60_000 }).toBeGreaterThanOrEqual(1)
  // Wait for the autoplay to settle on its round (or the game to end first), then for the sweep to pass.
  let last = -1
  for (let i = 0; i < 40; i++) {
    const now = await at()
    if (now >= round || (now === last && now > 0)) break
    last = now
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1800)
  return at()
}
const light = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.map-wrap')!
    const cs = getComputedStyle(el)
    return { phase: el.dataset.light, token: cs.getPropertyValue('--table-light').trim(), x: cs.getPropertyValue('--light-x').trim() }
  })

test('the light on the table differs between round 1 and round 5', async ({ page }, testInfo) => {
  test.setTimeout(150_000)
  expect(await tableAt(page, 1)).toBe(1)
  const first = await light(page)
  expect(first.phase).toBe('dawn')
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/table-r1-${testInfo.project.name}.png` })
  expect(await tableAt(page, 5)).toBe(5)
  const fifth = await light(page)
  expect(fifth.phase).toBe('noon')
  expect(fifth.token).not.toBe(first.token)
  expect(fifth.x).not.toBe(first.x)
  if (process.env.SHOTS) {
    await page.screenshot({ path: `e2e/screenshots/table-r5-${testInfo.project.name}.png` })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `e2e/screenshots/table-r5-dark-${testInfo.project.name}.png` })
    await page.emulateMedia({ colorScheme: 'light' })
    const r = await tableAt(page, 10)
    await page.screenshot({ path: `e2e/screenshots/table-r10-${testInfo.project.name}.png` })
    testInfo.annotations.push({ type: 'last round shot', description: String(r) })
  }
})
