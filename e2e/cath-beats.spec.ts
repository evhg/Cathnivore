import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 436: at the desktop table Cath answers what happens on the board with a visible beat (a hop, a flinch,
// a lean), within 400 ms of the event, and each distinct reaction shows its own expression.
test('Cath reacts at the table with a beat per event', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'her table figure stands beside the board at D')
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const cath = page.locator('.table-cath')
  await expect(cath).toBeVisible()
  await page.waitForFunction(() => typeof (window as unknown as { cathnivoreMoment?: unknown }).cathnivoreMoment === 'function')
  const seen = new Set<string>([(await cath.getAttribute('data-expression'))!])
  for (const [kind, mood] of [['squeeze', 'worried'], ['liberate', 'delighted']] as const) {
    const r = await page.evaluate(([kind, mood]) => new Promise<{ ms: number; anim: string }>((done) => {
      const el = document.querySelector('.table-cath')!
      const t0 = performance.now()
      const check = () => {
        if (el.getAttribute('data-beat-mood') === mood) {
          const fig = el.querySelector('.table-cath-figure > *')!
          done({ ms: performance.now() - t0, anim: getComputedStyle(fig).animationName })
        } else requestAnimationFrame(check)
      }
      ;(window as unknown as { cathnivoreMoment: (k: string, r: string) => void }).cathnivoreMoment(kind, 'kingsmarket')
      check()
    }), [kind, mood] as const)
    expect(r.ms, kind).toBeLessThan(400)
    expect(r.anim, kind).toMatch(/cath-beat-/)
    seen.add((await cath.getAttribute('data-expression'))!)
  }
  // the greeting's smirk, the Squeeze's worry, the liberation's delight
  expect(seen.size).toBeGreaterThanOrEqual(3)
})

test('under reduced motion her beats are stills', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'her table figure stands beside the board at D')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game .map').waitFor() // the Setup's opening board is a .map too (item 513)
  await page.waitForFunction(() => typeof (window as unknown as { cathnivoreMoment?: unknown }).cathnivoreMoment === 'function')
  await page.evaluate(() => (window as unknown as { cathnivoreMoment: (k: string, r: string) => void }).cathnivoreMoment('liberate', 'kingsmarket'))
  await expect(page.locator('.table-cath')).toHaveAttribute('data-beat-mood', 'delighted')
  expect(await page.locator('.table-cath-figure > *').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
})

test('on a phone her dock bust takes the same beat', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the dock is the phone table')
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game .map').waitFor() // the Setup's opening board is a .map too (item 513)
  await page.waitForFunction(() => typeof (window as unknown as { cathnivoreMoment?: unknown }).cathnivoreMoment === 'function')
  await page.evaluate(() => (window as unknown as { cathnivoreMoment: (k: string, r: string) => void }).cathnivoreMoment('squeeze', 'kingsmarket'))
  const dock = page.locator('.cath-dock')
  await expect(dock).toHaveAttribute('data-beat-mood', 'worried', { timeout: 400 })
  expect(await page.locator('.cath-dock-bust > *').first().evaluate((e) => getComputedStyle(e).animationName)).toMatch(/cath-beat-/)
})
