import { expect, test, type Page } from '@playwright/test'

// CATHODE C1 (docs/design/cathode-combat.md): cover tells the truth. A guard behind a steel crate gives the
// "blocked" brackets and no hit marker; his head over the crate is a hit. Driven through the screenshot
// stages (window.cathode.stage), which fire a real Kestrel round through the real combat code.

type Win = { cathode?: { stats: { frames: number }; stage?: (n: string, t?: number) => string; hud?: { hitClass: string | null } } }

async function boot(page: Page, touch = false): Promise<void> {
  // The phone project is upright; CATHODE plays held sideways (844x390), so turn it.
  if (touch) await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/cathode/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/cathode/?play&shot&rs=0.5')
  await page.waitForFunction(() => ((window as unknown as Win).cathode?.stats.frames ?? 0) >= 2 && typeof (window as unknown as Win).cathode?.stage === 'function', null, { timeout: 200_000 })
}

const opacity = (page: Page, sel: string) => page.evaluate((q) => Number(getComputedStyle(document.querySelector(q)!).opacity), sel)

test.describe('CATHODE combat feedback', () => {
  test('a guard behind a crate gives `blocked` and no hit marker; his head over it is a hit', async ({ page, hasTouch }) => {
    test.setTimeout(300_000)
    await boot(page, hasTouch)
    const blocked = await page.evaluate(() => (window as unknown as Win).cathode!.stage!('blocked', 40))
    expect(blocked).toBe('blocked')
    await page.waitForTimeout(400)
    expect(await opacity(page, '.hud-hit')).toBeLessThan(0.01)
    expect(await opacity(page, '.hud-blocked')).toBeGreaterThan(0.5)
    await expect(page.locator('.hud-blocked-l')).toBeVisible()

    const head = await page.evaluate(() => (window as unknown as Win).cathode!.stage!('peek-head', 40))
    expect(head).toBe('head')
    await page.waitForTimeout(400)
    expect(await opacity(page, '.hud-hit')).toBeGreaterThan(0.5)
    await expect(page.locator('.hud-hit.c-head')).toHaveCount(1)
  })

  test('hitFlesh plays only for her rounds landing on an enemy, never when Cath is hit (S1.3 spy)', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough: the sound routing is the same')
    test.setTimeout(300_000)
    await boot(page)
    // Wrap the live session's audio: count every hitFlesh and hurt, then call through.
    const spied = await page.evaluate(() => {
      const c = (window as unknown as { cathode: { audio?: Record<string, (...a: unknown[]) => unknown> | null } }).cathode
      const a = c.audio
      if (!a) return false
      const w = window as unknown as { spy: { hitFlesh: number; hurt: number } }
      w.spy = { hitFlesh: 0, hurt: 0 }
      for (const k of ['hitFlesh', 'hurt'] as const) {
        const f = a[k]!.bind(a)
        a[k] = (...args: unknown[]) => {
          w.spy[k]++
          return f(...args)
        }
      }
      return true
    })
    expect(spied).toBe(true)
    const spy = () => page.evaluate(() => (window as unknown as { spy: { hitFlesh: number; hurt: number } }).spy)
    // Her round lands on a guard: one wet thud (the spy works).
    expect(await page.evaluate(() => (window as unknown as Win).cathode!.stage!('hit-body', 40))).toBe('body')
    expect((await spy()).hitFlesh).toBe(1)
    // Cath is shot, then struck in melee: her hurt sound each time, and no hitFlesh.
    await page.evaluate(() => {
      const c = (window as unknown as { cathode: { cathHurt: (b: number, m: boolean) => void } }).cathode
      c.cathHurt(0.5, false)
      c.cathHurt(-1, true)
    })
    expect(await spy()).toEqual({ hitFlesh: 1, hurt: 2 })
  })

  test('a kill rings the marker and clears the target bar', async ({ page, hasTouch }) => {
    // One phone run (the cover test) is enough: under SwiftShader each costs about a minute.
    test.skip(hasTouch, 'the phone layout is covered by the cover test above')
    test.setTimeout(300_000)
    await boot(page)
    // 650 ms on: past the bar's real collapse (180 ms flash and 400 ms fade).
    const cls = await page.evaluate(() => (window as unknown as Win).cathode!.stage!('hit-kill', 650))
    expect(cls).toBe('kill')
    await page.waitForTimeout(400)
    await expect(page.locator('.hud-hit.c-kill')).toHaveCount(1)
    await expect(page.locator('.hud-target')).toBeHidden()
  })
})
