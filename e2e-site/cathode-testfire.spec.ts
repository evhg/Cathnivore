import { expect, test } from './own-gpu'

// Plan item 464: on the class pick the class weapon can be tried: each Test fire (or F) is a shot, the magazine
// counts down on the sheet at the weapon's cadence, empties into a reload, and comes back full; a new class starts
// a fresh magazine.
test('test-fire the class weapon: the magazine counts down and reloads', async ({ page }) => {
  test.setTimeout(400_000)
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?play&rs=0.5')
  const pick = page.locator('.cp')
  await expect(pick).toBeVisible({ timeout: 300_000 })
  const shots: number[] = []
  await page.exposeFunction('__shot', (n: number) => shots.push(n))
  await page.evaluate(() => document.querySelector('.cp')!.addEventListener('testfire', (e) => (window as unknown as { __shot: (n: number) => void }).__shot((e as CustomEvent<{ left: number }>).detail.left)))
  const mag = page.locator('.cp-weapon-nums div').nth(2).locator('dd')
  const full = Number(await mag.textContent())
  expect(full).toBeGreaterThan(0)
  const fire = page.locator('.cp-testfire')
  await expect(fire).toBeVisible()
  await fire.click()
  await expect(pick).toHaveAttribute('data-testfire', '1')
  await expect(mag).toHaveText(`${full - 1} / ${full}`)
  // Empty it (each shot waits out the cadence), then the reload brings it back full.
  for (let i = 1; i < full; i++) {
    await page.waitForTimeout(2000)
    await fire.click()
  }
  // (the reload itself can be over before a read lands under SwiftShader; the count says the magazine emptied)
  await expect(mag).toHaveText(`${full} / ${full}`, { timeout: 15_000 })
  expect(shots.slice(0, full)).toEqual(Array.from({ length: full }, (_, i) => full - 1 - i))
  // F fires too, and a new class starts its own magazine.
  await page.keyboard.press('2')
  await expect(pick).toHaveAttribute('data-class', 'butcher')
  const full2 = Number(await mag.textContent())
  await page.waitForTimeout(1500)
  await page.keyboard.press('f')
  await expect(mag).toHaveText(`${full2 - 1} / ${full2}`)
})
