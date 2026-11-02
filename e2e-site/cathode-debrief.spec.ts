import { expect, test } from '@playwright/test'

// Plan item 17: the morning-after debrief. With the clinic register taken, she's in the clinic for Vane; the test
// closes the case through the job's own hook, and the debrief comes up on the cork: the print crossed out, a
// stamped grade, and counters that end on the session's own ledger. Then again with reduced motion, where every
// number is final the moment it opens.

type Ledger = { kills: number; headshots: number; takedowns: number; seconds: number; scrip: number; xp: number; damageTaken: number }
type C = {
  stats: { frames: number }
  progress: { jobsDone: string[]; save(): void }
  hurtCath(amount: number, from: null, kind: string): void
  finishCase?: () => void
  showDebrief?: (id: string) => void
  debrief?: { caseId: string; ledger: Ledger; stills: number }
  debriefDelayMs?: number
  debriefStay?: boolean
}
const TO_CLINIC = ['fishMarket', 'crispLead', 'quayContracts', 'candorManifest', 'crispBoss', 'vaneLead']

test('closing the clinic case opens the debrief, and its counters end on the session ledger', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one run is enough; the debrief is DOM over the same session on a phone')
  test.setTimeout(420_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?play&class=ghost&rs=0.5')
  await page.waitForFunction(() => ((window as unknown as { cathode?: C }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })
  await page.evaluate((jobs) => {
    const c = (window as unknown as { cathode: C }).cathode
    c.progress.jobsDone.push(...jobs)
    c.progress.save()
  }, TO_CLINIC)
  await page.goto('/nightshift/?play&district=clinic&rs=0.5')
  await page.waitForFunction(() => ((window as unknown as { cathode?: C }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })

  // A graze, so the visit has something on its ledger; then Vane's case closes.
  await page.evaluate(() => {
    const c = (window as unknown as { cathode: C }).cathode
    c.hurtCath(12, null, 'bullet')
    c.debriefDelayMs = 500
    c.debriefStay = true
    c.finishCase?.()
  })
  const deb = page.getByRole('dialog', { name: /Debrief/ })
  await expect(deb).toBeVisible({ timeout: 60_000 })
  await expect(deb.locator('.debrief-stamp')).toHaveAttribute('aria-label', /Grade [SABCD]/)
  await expect(deb.locator('.debrief-cross')).toHaveCount(1)
  expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.progress.jobsDone.includes('vaneBoss'))).toBe(true)
  // The count-up lands on the ledger.
  await expect(page.locator('.debrief.is-counted')).toHaveCount(1, { timeout: 30_000 })
  const ledger = await page.evaluate(() => (window as unknown as { cathode: C }).cathode.debrief!.ledger)
  expect(ledger.damageTaken).toBeGreaterThan(0)
  const shown = async () => Object.fromEntries(await deb.locator('dd[data-k]').evaluateAll((els) => els.map((e) => [(e as HTMLElement).dataset.k, e.textContent])))
  const want = {
    scrip: `+${ledger.scrip}`,
    xp: `+${ledger.xp}`,
    kills: String(ledger.kills),
    headshots: String(ledger.headshots),
    takedowns: String(ledger.takedowns),
    time: `${Math.floor(Math.round(ledger.seconds) / 60)}:${String(Math.round(ledger.seconds) % 60).padStart(2, '0')}`,
  }
  expect(await shown()).toEqual(want)
  // The keepsake went into her bag.
  await expect(deb.locator('.debrief-keep')).toContainText('Velvet Knuckles')
  await page.keyboard.press('Escape')
  await expect(deb).toHaveCount(0)

  // Reduced motion: the numbers are final the moment it opens.
  await page.evaluate(() => {
    document.documentElement.classList.add('reduce-motion')
    ;(window as unknown as { cathode: C }).cathode.showDebrief!('vaneBoss')
  })
  await expect(deb).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.debrief.is-calm.is-counted')).toHaveCount(1)
  const now = await shown()
  expect(now.kills).toBe(want.kills)
  expect(now.scrip).toBe(want.scrip)
  expect(now.xp).toBe(want.xp)
  // The keepsake is only given once.
  await expect(deb.locator('.debrief-keep')).toHaveCount(0)
})
