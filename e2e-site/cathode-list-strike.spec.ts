import { expect, test } from './own-gpu'

// Plan item 137: the first title visit after a boss case closes crosses the name off The List: its print gets
// `data-struck="fresh"` (a red marker draws across it), the next target's photo develops in, and the count under
// the logotype ticks down. It plays once: the next visit shows the name struck, still.
type C = { stats: { frames: number }; progress: { jobsDone: string[]; save(): void } }
type Front = { cathodeFront?: { ready?: boolean } }
const ACT1 = ['fishMarket', 'crispLead', 'quayContracts', 'candorManifest', 'crispBoss']

test('a closed boss case is crossed off The List on the next title, once', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the mugshot wall is the same on a phone; one size is enough under swiftshader')
  test.setTimeout(420_000)
  await page.setViewportSize({ width: 1440, height: 900 })
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

  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const crisp = page.locator('#the-list-wall .mug').first()
  await expect(crisp).toHaveAttribute('data-struck', 'fresh')
  await expect(page.locator('#the-list-wall .mug[data-developing]')).toHaveCount(1)
  await expect(page.locator('#the-list-wall .mug').nth(1)).toHaveAttribute('data-developing', '')
  // The count ticks from five to four.
  await expect(page.locator('#title-sub')).toContainText('4 NAMES LEFT', { timeout: 10_000 })
  await expect(page.locator('#title-sub')).toHaveClass(/is-ticking/)
  // Cath says so under the heading.
  await expect(page.locator('#list-line')).toBeVisible()
  await expect(page.locator('#list-line')).toContainText("Crisp's done. Vane next.")

  // Once only.
  await page.reload()
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  await expect(page.locator('#the-list-wall .mug').first()).toHaveAttribute('data-struck', '')
  await expect(page.locator('#the-list-wall .mug[data-developing]')).toHaveCount(0)
  await expect(page.locator('#list-line')).toBeHidden()
  await expect(page.locator('#title-sub')).toContainText('4 NAMES LEFT')
})
