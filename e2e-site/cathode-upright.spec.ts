import { expect, test } from '@playwright/test'

// Plan item 44: a phone held upright gets a designed screen, not a dead-end card: Cath, a phone turning on its
// side, Back to the title, and the office's case board, wardrobe and gun bench, each usable upright.

test.describe('NIGHT SHIFT upright (plan item 44)', () => {
  test('the case board and wardrobe open upright at P, and close back to the screen', async ({ browser, hasTouch, baseURL }) => {
    test.skip(!hasTouch, 'a phone held upright')
    test.setTimeout(300_000)
    const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/nightshift/?play&class=ghost')
    await page.waitForFunction(() => ((window as unknown as { cathode?: { stats: { frames: number } } }).cathode?.stats.frames ?? 0) >= 1, null, { timeout: 200_000 })

    const screen = page.locator('.rotate.upright')
    await expect(screen).toBeVisible()
    await expect(screen.locator('.up-cath svg')).toBeVisible()
    await expect(screen.locator('.up-turn svg')).toBeVisible()
    await expect(screen.locator('a.up-back')).toHaveAttribute('href', './')
    // The keys sit whole on the screen, with tap-sized targets.
    for (const st of ['board', 'wardrobe', 'bench']) {
      const box = await screen.locator(`.up-key[data-station="${st}"]`).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y + box!.height).toBeLessThanOrEqual(844)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    // The case board: over the screen, the frozen HUD hidden round it; Escape closes it.
    await screen.locator('.up-key[data-station="board"]').tap()
    const board = page.locator('.case-board')
    await expect(board).toBeVisible()
    await expect(screen).toBeHidden()
    await expect(page.locator('#hud')).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(board).toHaveCount(0)
    await expect(screen).toBeVisible()

    // The wardrobe: full width upright, closed by its own Step away.
    await screen.locator('.up-key[data-station="wardrobe"]').tap()
    const wardrobe = page.locator('.bench.wardrobe')
    await expect(wardrobe).toBeVisible()
    const panel = await wardrobe.locator('.bench-panel').boundingBox()
    expect(panel!.width).toBeGreaterThanOrEqual(380)
    await page.keyboard.press('Escape')
    await expect(wardrobe).toHaveCount(0)
    await expect(screen).toBeVisible()
    expect(errors).toEqual([])
    await ctx.close()
  })
})
