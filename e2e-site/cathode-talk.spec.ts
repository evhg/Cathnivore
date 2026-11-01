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
