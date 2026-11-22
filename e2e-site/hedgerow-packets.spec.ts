import { expect, test } from '@playwright/test'

// Plan item 628: the build shop as seed packets. No bare glyph badges (the 'answers' tag says 'For' beside the lock's
// icon, where it was the icon and a tick); at D each packet names its role in words at 13 px with its range as pips;
// picking a packet (a click with no plot chosen) lifts it out of the rack within 250 ms and turns its numbers up.
const seed = (l: number) => JSON.stringify({ version: 3, stars: {}, seenBefore: { [l]: true }, tips: { all: true } })

test('level 21: worded seed tags, role words at D, a picked packet lifts', async ({ page }) => {
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate((s) => localStorage.setItem('hedgerow:v1', s), seed(21))
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 30_000 })
  const packets = page.locator('.tray-tower')
  await expect(packets.first()).toBeVisible()
  // No packet carries a bare tick or cross.
  expect(await page.locator('.tray').evaluate((t) => /[✓✕]/.test(t.textContent ?? ''))).toBe(false)
  const tag = page.locator('.tray-tower[data-kind="scarecrow"] .tray-answers')
  await expect(tag.locator('.ans-for')).toHaveText('For')
  await expect(tag.locator('.prop-icon')).toHaveCount(1)
  await expect(tag).toHaveAttribute('title', /Airborne/)
  const desktop = (page.viewportSize()?.width ?? 0) >= 900 && (page.viewportSize()?.height ?? 0) > 520
  if (desktop) {
    for (const p of await packets.all()) {
      const word = p.locator('.tray-role-word')
      await expect(word).toBeVisible()
      expect(await word.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(13)
      await expect(p.locator('.pip-row.range')).toBeVisible()
    }
  }
  // The Scarecrow: the packet her line names, so a phone's tray has it in view.
  const pick = page.locator('.tray-tower[data-kind="scarecrow"]')
  const y0 = (await pick.boundingBox())!.y
  await pick.click()
  await expect(pick).toHaveAttribute('data-picked', '')
  await page.waitForTimeout(250)
  expect((await pick.boundingBox())!.y).toBeLessThan(y0 - 1.5)
  if (desktop) await expect(pick.locator('.tray-stats')).toHaveCSS('opacity', '1')
  // A second pick puts it back.
  await pick.click()
  await expect(pick).not.toHaveAttribute('data-picked', '')
})
