import { test, expect } from '@playwright/test'

// Plan item 189: a producer's role ability is staged over the hex it acted on: a `[data-moment="ability-<id>"]`
// node over the tile within 300 ms that is gone by 1.4 s, with no transform under reduced motion.
async function start(page: import('@playwright/test').Page) {
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('svg.map')).toBeVisible()
  await page.waitForTimeout(400)
}

for (const producer of ['mara', 'tomas', 'ines', 'sol'] as const) {
  test(`${producer}'s ability is a staged moment over its tile`, async ({ page }) => {
    await start(page)
    const r = await page.evaluate(async (p) => {
      const hex = document.querySelectorAll('.region-hex')[2]!
      const id = hex.getAttribute('data-region')!
      ;(window as unknown as { cathnivoreAbility(p: string, id: string): void }).cathnivoreAbility(p, id)
      const t0 = performance.now()
      let node: Element | null = null
      while (!(node = document.querySelector(`[data-moment="ability-${p}"]`)) && performance.now() - t0 < 1000) await new Promise((r) => setTimeout(r, 5))
      const seen = performance.now() - t0
      if (!node) return { seen, gone: -1, overlap: false, region: null }
      await new Promise((r) => setTimeout(r, 300))
      const a = node.getBoundingClientRect()
      const b = hex.querySelector('polygon')!.getBoundingClientRect()
      const cx = a.left + a.width / 2, cy = a.top + a.height / 2
      const overlap = cx > b.left && cx < b.right && cy > b.top && cy < b.bottom
      while (document.querySelector(`[data-moment="ability-${p}"]`) && performance.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 10))
      return { seen, gone: performance.now() - t0, overlap, region: node.getAttribute('data-region') === id }
    }, producer)
    expect(r.seen).toBeLessThan(300)
    expect(r.overlap).toBe(true)
    expect(r.region).toBe(true)
    expect(r.gone).toBeGreaterThan(600)
    expect(r.gone).toBeLessThan(1400)
  })
}

test('a real Injunction from the hand stages its moment', async ({ page }) => {
  await start(page)
  const card = page.getByRole('button', { name: /Injunction/ }).first()
  test.skip(!(await card.isVisible().catch(() => false)), 'Mara does not open this seat')
  await card.click()
  const pick = page.locator('.region-hex-selectable.glow').first()
  if (await pick.isVisible({ timeout: 800 }).catch(() => false)) await pick.click()
  await expect(page.locator('[data-moment="ability-mara"]')).toHaveCount(1, { timeout: 1500 })
  await expect(page.locator('[data-moment="ability-mara"]')).toHaveCount(0, { timeout: 2000 })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('the moment only fades', async ({ page }) => {
    await start(page)
    const t = await page.evaluate(async () => {
      const id = document.querySelectorAll('.region-hex')[2]!.getAttribute('data-region')!
      ;(window as unknown as { cathnivoreAbility(p: string, id: string): void }).cathnivoreAbility('tomas', id)
      await new Promise((r) => setTimeout(r, 120))
      return [...document.querySelectorAll('.ability-moment *')].map((e) => getComputedStyle(e).animationName).filter((n) => n !== 'none')
    })
    expect(t).toEqual([])
  })
})
