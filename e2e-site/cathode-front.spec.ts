import { expect, test, type Page } from '@playwright/test'

// CATHODE C13 (docs/design/cathode-combat.md S9): the front door. One focus for every input, fixed slots with a
// tick on each move, and starting the game is a camera move into the street: no navigation, no reload.

type Front = { cathodeFront?: { ready: boolean; ticks: number }; cathode?: { stats: { frames: number } }; marker?: number }

async function open(page: Page, touch: boolean, q = ''): Promise<void> {
  if (touch) await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/cathode/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto(`/cathode/?rs=0.5${q}`)
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 120_000 })
}

test.describe('CATHODE front door', () => {
  test('the menu keeps fixed slots, wraps, ticks on every move, and Escape disarms', async ({ page, hasTouch }) => {
    test.setTimeout(180_000)
    await open(page, hasTouch)
    const items = page.locator('#menu .menu-item')
    await expect(items).toHaveCount(4)
    // No save: CONTINUE keeps its row but is off; focus starts on NEW CASE.
    await expect(page.locator('#btn-continue')).toBeDisabled()
    await expect(page.locator('#btn-begin')).toHaveClass(/is-focus/)
    const ticks = () => page.evaluate(() => (window as unknown as Front).cathodeFront!.ticks)
    const t0 = await ticks()
    await page.keyboard.press('ArrowUp')
    await expect(page.locator('#btn-credits')).toHaveClass(/is-focus/)
    await page.keyboard.press('s')
    await expect(page.locator('#btn-begin')).toHaveClass(/is-focus/)
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('#btn-settings')).toHaveClass(/is-focus/)
    expect((await ticks()) - t0).toBe(3)
    await expect(page.locator('#menu-hint')).toHaveText(/GRAPHICS/)
    // Settings opens and Escape brings the menu back with its focus.
    await page.keyboard.press('Enter')
    await expect(page.locator('#dlg-settings')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#dlg-settings')).toBeHidden()
    await expect(page.locator('#btn-settings')).toHaveClass(/is-focus/)
    // The subtitle and The List come from progress.
    await expect(page.locator('#title-sub')).toHaveText('HOLLOWELL PROPER · 2079 · 5 NAMES LEFT')
    await expect(page.locator('#the-list li')).toHaveCount(5)
  })

  test('New Case pushes into the street and names the area, with no navigation', async ({ page, hasTouch }) => {
    test.setTimeout(400_000)
    await open(page, hasTouch, '&class=ghost')
    await page.evaluate(() => ((window as unknown as Front).marker = 7))
    await page.locator('#btn-begin').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#area-title')).toBeVisible({ timeout: 300_000 })
    await expect(page.locator('#area-name')).toHaveText('THE FISH MARKET')
    await page.waitForFunction(() => ((window as unknown as Front).cathode?.stats.frames ?? 0) >= 1, null, { timeout: 120_000 })
    // The same document: the push handed the street to the game instead of loading a page.
    expect(await page.evaluate(() => (window as unknown as Front).marker)).toBe(7)
    await expect(page.locator('#screen-title')).toBeHidden()
  })
})
