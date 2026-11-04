import { test, expect } from '@playwright/test'

// Plan item 127: a liberation and a Squeeze are staged on their tile: the map carries data-moment for 700-1200 ms
// and nothing on the page moves by more than 2 px while it plays.
for (const kind of ['liberate', 'squeeze'] as const) {
  test(`a ${kind} is a staged moment on its tile`, async ({ page }) => {
    await page.goto('/?e2eMoment=1')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    const map = page.locator('svg.map')
    await expect(map).toBeVisible()
    await page.waitForTimeout(500)
    const box = async () => (await map.boundingBox())!
    const before = await box()
    const r = await page.evaluate(async (k) => {
      const id = document.querySelectorAll('.region-hex')[3]!.getAttribute('data-region')!
      const svg = document.querySelector('svg.map')!
      ;(window as unknown as { cathnivoreMoment(k: string, id: string): void }).cathnivoreMoment(k, id)
      // Timed from when the map shows the moment to when it ends (React renders it a frame or two after the call).
      const c0 = performance.now()
      while (!svg.hasAttribute('data-moment') && performance.now() - c0 < 1000) await new Promise((r) => setTimeout(r, 5))
      const on = svg.getAttribute('data-moment')
      const t0 = performance.now()
      while (svg.hasAttribute('data-moment') && performance.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 10))
      return { on, ms: performance.now() - t0 }
    }, kind)
    expect(r.on).toBe(kind)
    expect(r.ms).toBeGreaterThanOrEqual(700)
    expect(r.ms).toBeLessThanOrEqual(1200)
    const after = await box()
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y) + Math.abs(after.height - before.height)).toBeLessThanOrEqual(2)
  })
}
