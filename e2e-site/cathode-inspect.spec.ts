import { expect, test, type Page } from '@playwright/test'

// Plan item 26: the weapon inspect is a real input. `input.forced = {inspect: true}` (the I key's intent) plays
// it, aiming cancels it, and on a phone a long press on the weapon's name asks for it.

type C = {
  stats: { frames: number }
  job?: unknown
  input: { forced: Record<string, boolean> }
  arsenal: { busy: boolean; inspects: number; inspecting: boolean; inspectW: number; weapon: { weaponClass: string } }
}

async function boot(page: Page): Promise<void> {
  // CATHODE plays held sideways: landscape on every project.
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?play&class=gunslinger&rs=0.5')
  await page.waitForFunction(() => {
    const c = (window as unknown as { cathode?: C }).cathode
    return !!c?.job && c.stats.frames >= 3
  }, null, { timeout: 200_000 })
  // The first draw holds the gun busy: an inspect asked for during it is refused (as a reload would be).
  await page.waitForFunction(() => !(window as unknown as { cathode: C }).cathode.arsenal.busy, null, { timeout: 200_000 })
}

test.describe('NIGHT SHIFT weapon inspect (plan item 26)', () => {
  test('input.forced = {inspect: true} plays the inspect through to the end', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'the touch path is the long press below')
    test.setTimeout(400_000)
    await boot(page)
    const before = await page.evaluate(() => (window as unknown as { cathode: C }).cathode.arsenal.inspects)
    await page.evaluate(() => ((window as unknown as { cathode: C }).cathode.input.forced = { inspect: true }))
    await page.waitForFunction((n) => (window as unknown as { cathode: C }).cathode.arsenal.inspects > n, before, { timeout: 60_000 })
    // The gun turns: the turn's weight rises above half at some frame while it plays.
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.arsenal.inspectW > 0.5, null, { timeout: 120_000, polling: 50 })
    // And it ends on its own.
    await page.waitForFunction(() => !(window as unknown as { cathode: C }).cathode.arsenal.inspecting, null, { timeout: 200_000 })
    expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.arsenal.inspectW)).toBe(0)
  })

  test('aiming cancels the inspect', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough')
    test.setTimeout(400_000)
    await boot(page)
    await page.evaluate(() => ((window as unknown as { cathode: C }).cathode.input.forced = { inspect: true }))
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.arsenal.inspecting, null, { timeout: 60_000 })
    await page.evaluate(() => ((window as unknown as { cathode: C }).cathode.input.forced = { aim: true }))
    await page.waitForFunction(() => !(window as unknown as { cathode: C }).cathode.arsenal.inspecting, null, { timeout: 60_000 })
  })

  test('touch: a long press on the weapon name asks for the inspect; a tap does not', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'touch only')
    test.setTimeout(400_000)
    await boot(page)
    const chip = page.locator('.hud-weapon')
    await expect(chip).toBeVisible()
    const n0 = await page.evaluate(() => (window as unknown as { cathode: C }).cathode.arsenal.inspects)
    const box = (await chip.boundingBox())!
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    // A tap: down and straight up.
    await chip.dispatchEvent('pointerdown', { clientX: at.x, clientY: at.y, pointerType: 'touch', isPrimary: true })
    await chip.dispatchEvent('pointerup', { clientX: at.x, clientY: at.y, pointerType: 'touch', isPrimary: true })
    await page.waitForTimeout(900)
    expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.arsenal.inspects)).toBe(n0)
    // A long press.
    await chip.dispatchEvent('pointerdown', { clientX: at.x, clientY: at.y, pointerType: 'touch', isPrimary: true })
    await page.waitForFunction((n) => (window as unknown as { cathode: C }).cathode.arsenal.inspects > n, n0, { timeout: 60_000 })
    await chip.dispatchEvent('pointerup', { clientX: at.x, clientY: at.y, pointerType: 'touch', isPrimary: true })
  })
})
