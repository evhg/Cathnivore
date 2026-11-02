import { expect, test } from '@playwright/test'

// Plan item 16: Cath's office, the hub between cases. Continue from the title lands in it once the first job is
// done; each station opens its screen from its spot; she walks to the stair door and the water taxi loads the
// district the open case runs in (the clinic, with act 1 closed).

type V3 = { x: number; y: number; z: number; set(x: number, y: number, z: number): void }
type C = {
  stats: { frames: number }
  player: { pos: V3; yaw: number; pitch: number }
  input: { forced: Record<string, boolean> }
  progress: { jobsDone: string[]; save(): void; character: { scrip: number }; set(c: unknown): void }
  lastStation?: string
  benchParts?: string[]
  travelling?: string
}
const ACT1 = ['fishMarket', 'crispLead', 'quayContracts', 'candorManifest', 'crispBoss']

test('Continue lands in the office, the stations open, and the stair door takes her to the next case', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'walked with the keyboard; the stations are the same on a phone')
  test.setTimeout(420_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  // A real save from the game itself, with act 1 closed.
  await page.goto('/nightshift/?play&class=ghost&rs=0.5')
  await page.waitForFunction(() => ((window as unknown as { cathode?: C }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })
  await page.evaluate((jobs) => {
    const c = (window as unknown as { cathode: C }).cathode
    c.progress.jobsDone.push(...jobs)
    c.progress.save()
  }, ACT1)
  // The title's Continue.
  await page.goto('/nightshift/?rs=0.5')
  const cont = page.locator('#btn-continue')
  await expect(cont).toBeEnabled({ timeout: 60_000 })
  await cont.click()
  await expect(page.locator('#area-title')).toContainText("CATH'S OFFICE", { timeout: 200_000 })
  await page.waitForFunction(() => ((window as unknown as { cathode?: C }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })
  expect(page.url()).not.toContain('district=')

  // Bea's line, from the desk.
  const at = (x: number, z: number) =>
    page.evaluate(([x, z]) => {
      const p = (window as unknown as { cathode: C }).cathode.player
      p.pos.set(x!, p.pos.y, z!)
    }, [x, z])
  const use = () => page.evaluate(() => ((window as unknown as { cathode: C }).cathode.input.forced.takedown = true))
  await at(-2.6, 1.6)
  await expect(page.getByRole('button', { name: "Call Bea's line" })).toBeVisible({ timeout: 30_000 })
  await use()
  await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.lastStation === 'phone', null, { timeout: 30_000 })
  await expect(page.locator('.hud-sub').filter({ hasText: /Candor Clinic/ })).toBeVisible({ timeout: 30_000 })

  // The case board, from the cork wall.
  await at(0, -2.6)
  await use()
  const board = page.getByLabel('Case board', { exact: true })
  await expect(board).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('Escape')
  await expect(board).toBeHidden({ timeout: 30_000 })

  // The gun bench: the screen opens over the close-up, a part bought there goes onto the gun on the bench.
  await page.evaluate(() => {
    const p = (window as unknown as { cathode: C }).cathode.progress
    p.set({ ...p.character, scrip: 5000 })
  })
  await at(3.4, -0.6)
  await use()
  const bench = page.getByRole('dialog', { name: 'Gun bench' })
  await expect(bench).toBeVisible({ timeout: 30_000 })
  await bench.locator('[data-k="slot:mag"]').click()
  await bench.locator('[data-k="part:extendedMag"]').click()
  await expect(bench.locator('[data-k="slot:mag"]')).toContainText('Extended Mag')
  await expect(bench.getByRole('status')).toHaveText('Extended Mag fitted.')
  await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.benchParts?.includes('mag'), null, { timeout: 30_000 })
  expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.progress.character.scrip)).toBe(5000 - 250)
  await page.keyboard.press('Escape')
  await expect(bench).toBeHidden({ timeout: 30_000 })

  // The wardrobe: Cath at the mirror, her four pieces listed.
  await at(-3.4, -1.6)
  await use()
  const ward = page.getByRole('dialog', { name: 'Wardrobe' })
  await expect(ward).toBeVisible({ timeout: 30_000 })
  await expect(ward.locator('.bench-slot')).toHaveCount(4)
  await page.keyboard.press('Escape')
  await expect(ward).toBeHidden({ timeout: 30_000 })

  // Walk to the stair door with the keyboard: from the middle of the room, face east and hold W.
  await at(0, 2.6)
  await page.evaluate(() => {
    const p = (window as unknown as { cathode: C }).cathode.player
    p.yaw = Math.atan2(-3.2, -0.3)
    p.pitch = 0
  })
  await page.keyboard.down('KeyW')
  await page.waitForFunction(
    () => {
      const p = (window as unknown as { cathode: C }).cathode.player.pos
      return Math.hypot(p.x - 3.2, p.z - 2.9) < 1.1
    },
    null,
    { timeout: 120_000 },
  )
  await page.keyboard.up('KeyW')
  await expect(page.getByRole('button', { name: 'Take Water taxi to Candor Clinic' })).toBeVisible({ timeout: 30_000 })
  await Promise.all([page.waitForURL(/district=clinic/, { timeout: 60_000 }), use()])
  await expect(page.locator('#area-title')).toContainText('THE CANDOR CLINIC', { timeout: 200_000 })
})
