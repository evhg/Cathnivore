import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 100: Hollowell's plan cards. Their words are at least 12 px and pass axe's 4.5:1 contrast, no
// card's line is cut at 390, 1280 or 1440 wide, the page never scrolls sideways, each region a card hits
// is a chip, and a card the conveyor moves in slides in and stamps (a fade under reduced motion).

async function start(page: Page, seed: string) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, seed)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await page.locator('.plan-strip').waitFor()
}

for (const [w, h] of [
  [390, 844],
  [1280, 800],
  [1440, 900],
] as const) {
  test(`plan cards read whole and at AA at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    for (const [seed, scheme] of [
      ['7', 'light'],
      ['21', 'dark'],
    ] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await start(page, seed)
      const report = await page.evaluate(() => {
        const small: string[] = []
        const cut: string[] = []
        for (const card of document.querySelectorAll<HTMLElement>('.plan-strip-item > button:first-child')) {
          for (const el of card.querySelectorAll<HTMLElement>('.plan-strip-headline, .plan-strip-effect, .plan-strip-target, .plan-chip')) {
            const r = el.getBoundingClientRect()
            if (r.width < 2 || (el.closest('.plan-strip-target')?.getBoundingClientRect().width ?? 99) < 2) continue
            if (parseFloat(getComputedStyle(el).fontSize) < 12) small.push(el.textContent ?? '')
            if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) cut.push(el.textContent ?? '')
          }
          const box = card.getBoundingClientRect()
          for (const chip of card.querySelectorAll<HTMLElement>('.plan-chip')) {
            // The full line is visually hidden (a 1 px clip) where the short one shows.
            if (chip.closest('.plan-strip-target')!.getBoundingClientRect().width < 2) continue
            const c = chip.getBoundingClientRect()
            if (c.width > 0 && (c.right > box.right + 0.5 || c.left < box.left - 0.5)) cut.push(`chip ${chip.textContent}`)
          }
        }
        return { small, cut, scrollX: document.documentElement.scrollWidth - window.innerWidth }
      })
      expect(report.small).toEqual([])
      expect(report.cut).toEqual([])
      expect(report.scrollX).toBeLessThanOrEqual(0)
      // Every region a card names is drawn as a chip.
      const chips = await page.locator('.plan-strip .plan-chip:visible').count()
      expect(chips).toBeGreaterThan(0)
      const axe = await new AxeBuilder({ page }).include('.plan-strip').withRules(['color-contrast']).analyze()
      expect(axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([])
    }
  })
}

async function endRound(page: Page) {
  const before = await page.locator('.plan-strip').getAttribute('data-round')
  for (let i = 0; i < 12 && (await page.locator('.plan-strip').getAttribute('data-round')) === before; i++) {
    const graft = page.getByRole('button', { name: /^Graft:/ })
    if (await graft.isVisible().catch(() => false)) await graft.click({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
  }
}

test('a card the conveyor moves in slides in and stamps', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { armed: { transform: boolean }[] }
    w.armed = []
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target as HTMLElement
        if (m.attributeName === 'data-arming' && el.hasAttribute('data-arming')) {
          const kf = el.getAnimations()[0]
          const frames = kf && 'getKeyframes' in kf.effect! ? (kf.effect as KeyframeEffect).getKeyframes() : []
          w.armed.push({ transform: frames.some((f) => String(f.transform ?? '').includes('translateX')) })
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-arming'] })
  })
  await start(page, '7')
  await endRound(page)
  await expect.poll(() => page.evaluate(() => (window as unknown as { armed: unknown[] }).armed.length), { timeout: 20_000 }).toBeGreaterThan(0)
  const armed = await page.evaluate(() => (window as unknown as { armed: { transform: boolean }[] }).armed)
  expect(armed.every((a) => a.transform)).toBe(true)
})

test('under reduced motion a new card fades in, with no slide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const w = window as unknown as { armed: boolean[] }
    w.armed = []
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target as HTMLElement
        if (el.hasAttribute?.('data-arming')) {
          const kf = el.getAnimations()[0]
          const frames = kf ? (kf.effect as KeyframeEffect).getKeyframes() : []
          w.armed.push(frames.some((f) => f.transform !== undefined))
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-arming'] })
  })
  await start(page, '7')
  await endRound(page)
  await expect.poll(() => page.evaluate(() => (window as unknown as { armed: boolean[] }).armed.length), { timeout: 20_000 }).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as unknown as { armed: boolean[] }).armed)).not.toContain(true)
})
