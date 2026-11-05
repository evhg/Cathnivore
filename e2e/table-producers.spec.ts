import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 155: both producers sit at the table inside the map frame, opposite Cath: 160 px or taller at 1440x900,
// 64 px or taller on a phone, meeting no hex or name plaque. A Squeeze on a region where one has a Stall worries them.
test('the producers are seated at the table, and a Squeeze worries them', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  const phone = testInfo.project.name === 'phone'
  if (!phone) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const people = page.locator('.map-wrap [data-table-producer]')
  await expect(people).toHaveCount(2)
  await expect(people.nth(1)).toBeVisible()
  await page.waitForTimeout(400)
  const wrap = (await page.locator('.map-wrap').boundingBox())!
  const blockers = await page.evaluate(() =>
    [
      ...[...document.querySelectorAll('.region-hex')].map((h) => h.querySelector('polygon')!.getBoundingClientRect()),
      ...[...document.querySelectorAll('.region-plaque')].map((p) => p.getBoundingClientRect()),
    ].map((r) => ({ x: r.left, y: r.top, width: r.width, height: r.height })),
  )
  for (const person of await people.all()) {
    const b = (await person.boundingBox())!
    const id = await person.getAttribute('data-table-producer')
    expect(b.height, `${id} height`).toBeGreaterThanOrEqual(phone ? 64 : 160)
    expect(b.x).toBeGreaterThanOrEqual(wrap.x - 1)
    expect(b.y).toBeGreaterThanOrEqual(wrap.y - 5)
    expect(b.x + b.width).toBeLessThanOrEqual(wrap.x + wrap.width + 1)
    expect(b.y + b.height).toBeLessThanOrEqual(wrap.y + wrap.height + 1)
    for (const o of blockers) {
      const meets = b.x < o.x + o.width && o.x < b.x + b.width && b.y < o.y + o.height && o.y < b.y + b.height
      expect(meets, `${id} meets a hex or plaque`).toBe(false)
    }
  }
  // A Squeeze on each region in turn until one lands on a Stall: that producer's face turns worried.
  await expect(people.first()).toHaveAttribute('data-expression', 'neutral')
  const regions = await page.locator('.region-hex').evaluateAll((els) => els.map((e) => e.getAttribute('data-region')!))
  let worried = false
  for (const region of regions) {
    await page.evaluate((r) => (window as unknown as { cathnivoreMoment(k: string, id: string): void }).cathnivoreMoment('squeeze', r), region)
    await page.waitForTimeout(150)
    if ((await page.locator('.map-wrap [data-table-producer][data-expression="worried"]').count()) > 0) {
      worried = true
      break
    }
  }
  expect(worried, 'a Squeeze on a Stall worries its producer').toBe(true)
  // A liberation there delights its first Stall-holder, once the worry has passed.
  await page.waitForTimeout(200)
  const delighted = await page.evaluate(async (regions) => {
    for (const r of regions) {
      ;(window as unknown as { cathnivoreMoment(k: string, id: string): void }).cathnivoreMoment('liberate', r)
      await new Promise((res) => setTimeout(res, 150))
      if (document.querySelector('.map-wrap [data-table-producer][data-expression="delighted"]')) return true
    }
    return false
  }, regions)
  expect(delighted, 'a liberation delights a producer with a Stall there').toBe(true)
})
