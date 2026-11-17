import { expect, test } from './own-gpu'

// Plan item 465: the title's front door answers the player: as the menu's focus moves, her face answers each entry
// (New Case sets her jaw, the Case Board gets a wink, Settings and Credits her smirk), named as a pose on the canvas.
test('her face answers each title menu entry', async ({ page }) => {
  test.setTimeout(400_000)
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/')
  await page.waitForFunction(() => ((window as unknown as { cathodeFront?: { scene?: () => { stats?: { frames: number } } } }).cathodeFront?.scene?.()?.stats?.frames ?? 0) > 2, null, { timeout: 300_000 })
  const canvas = page.locator('canvas').first()
  const seen = new Map<string, string>()
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowDown')
    const slot = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.slot ?? '')
    await expect(canvas).toHaveAttribute('data-cath-pose', /.+/, { timeout: 10_000 })
    await expect.poll(async () => (await canvas.getAttribute('data-cath-pose')) ?? '', { timeout: 10_000 }).not.toBe(seen.get('last') ?? '__none__')
    const pose = (await canvas.getAttribute('data-cath-pose')) ?? ''
    seen.set(slot, pose)
    seen.set('last', pose)
  }
  seen.delete('last')
  expect(new Set(seen.values()).size, JSON.stringify([...seen])).toBeGreaterThanOrEqual(4)
  if (seen.has('cases')) expect(await canvas.getAttribute('data-cath-expr')).toBeTruthy()
})
