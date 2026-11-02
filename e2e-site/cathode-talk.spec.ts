import { expect, test } from '@playwright/test'

// Plan item 14: a talk in the clinic. The orderly's Pay choice spends Scrip and records a weakness; his Press
// choice is locked for a Ghost (Nerve 25 of 30). Opened with `?talk` in the clinic district.

type C = { stats: { frames: number }; progress: { jobsDone: string[]; character: { scrip: number } } }

test('a clinic talk shows locked and open choices, and paying records the intel', async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  if (hasTouch) await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?play&class=ghost&rs=0.5&district=clinic&talk')
  await page.waitForFunction(() => ((window as unknown as { cathode?: C }).cathode?.stats.frames ?? 0) >= 2, null, { timeout: 200_000 })
  const dialog = page.getByRole('dialog', { name: 'Talk: Orderly Kessel' })
  await expect(dialog).toBeVisible({ timeout: 60_000 })
  await expect(dialog.locator('[data-option="press"]')).toBeDisabled()
  await expect(dialog.locator('[data-option="press"] .talk-lock')).toHaveText('Needs Nerve 30')
  // A fresh Ghost has 50 Scrip, short of the orderly's 80: give her the money first.
  await page.evaluate(() => {
    ;(window as unknown as { cathode: C }).cathode.progress.character.scrip = 200
  })
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.evaluate(() => (window as unknown as { cathode: { talk: () => void } }).cathode.talk())
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await dialog.locator('[data-option="pay"]').click()
  await expect(dialog.locator('.talk-intel')).toHaveText('Intel: a weakness, noted on the case board.')
  const after = await page.evaluate(() => {
    const c = (window as unknown as { cathode: C }).cathode
    return { scrip: c.progress.character.scrip, done: c.progress.jobsDone.filter((j) => j.startsWith('talk:')) }
  })
  expect(after).toEqual({ scrip: 120, done: ['talk:orderly:pay'] })
  await dialog.getByRole('button', { name: 'Let him go' }).click()
  await expect(dialog).toBeHidden()
})

// Plan item 14, session 2: the talk opens by taking the district's lieutenant down. He walks the clinic under his
// own name (the red-dash mark over his head); behind him, the takedown, and the talk opens as she lets go.
test('taking the clinic lieutenant down opens his talk', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one layout is enough: the grab is the same on a phone')
  test.setTimeout(400_000)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  type V3 = { x: number; y: number; z: number; set(x: number, y: number, z: number): void }
  type E = { alive: boolean; position: V3; motion: { yaw: number }; kit: { name: string } }
  type L = {
    stats: { frames: number }
    lieutenant: () => E | null
    player: { pos: V3; yaw: number; pitch: number }
    input: { forced: Record<string, boolean> }
    takedown: { active: boolean }
    progress: { jobsDone: string[] }
  }
  // The tutorial must be over for the district's patrols to walk: boot the street once, mark the first job done
  // and save (a real save from the game itself).
  await page.goto('/nightshift/?play&class=wirewitch&rs=0.5')
  await page.waitForFunction(() => ((window as unknown as { cathode?: L }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })
  await page.evaluate(() => {
    const c = (window as unknown as { cathode: L & { progress: { save(): void } } }).cathode
    c.progress.jobsDone.push('fishMarket')
    c.progress.save()
  })
  await page.goto('/nightshift/?play&class=wirewitch&rs=0.5&district=clinic')
  await page.waitForFunction(() => ((window as unknown as { cathode?: L }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })
  expect(await page.evaluate(() => (window as unknown as { cathode: L }).cathode.lieutenant()?.kit.name)).toBe('Orderly Kessel')
  const behind = async () =>
    page.evaluate(() => {
      const c = (window as unknown as { cathode: L }).cathode
      const g = c.lieutenant()!
      const yaw = g.motion.yaw
      c.player.pos.set(g.position.x - Math.sin(yaw) * 1.3, g.position.y, g.position.z - Math.cos(yaw) * 1.3)
      c.player.yaw = Math.atan2(-Math.sin(yaw), -Math.cos(yaw))
      c.player.pitch = -0.15
    })
  await behind()
  await page.waitForFunction((f) => (window as unknown as { cathode: L }).cathode.stats.frames >= f + 2, await page.evaluate(() => (window as unknown as { cathode: L }).cathode.stats.frames))
  await expect(page.locator('.hud-elite.is-lt')).toHaveText('Orderly Kessel')
  // He walks his route between frames: put her back behind him on the frame she takes him.
  await behind()
  await page.evaluate(() => ((window as unknown as { cathode: L }).cathode.input.forced = { takedown: true }))
  await page.waitForFunction(() => (window as unknown as { cathode: L }).cathode.takedown.active, null, { timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Talk: Orderly Kessel' })
  await expect(dialog).toBeVisible({ timeout: 200_000 })
  await dialog.locator('[data-option="wire"]').click()
  await expect(dialog.locator('.talk-intel')).toContainText('Intel')
  expect(await page.evaluate(() => (window as unknown as { cathode: L }).cathode.progress.jobsDone.filter((j) => j.startsWith('talk:')))).toEqual(['talk:orderly:wire'])
  expect(await page.evaluate(() => (window as unknown as { cathode: L }).cathode.lieutenant())).toBeNull()
})
