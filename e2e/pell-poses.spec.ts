import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 467: Graham Pell drawn to Cath's standard and reacting at the table. Five table events each set his
// pose (`data-pell-pose`) within 300 ms; his head (hair to chin) is at least 90 px tall at D and 52 px on a phone;
// reduced motion stops the head turn, the blink and the tie (only the features' fade is left).

const EVENTS = [
  ['squeeze', 'gloat'],
  ['intents', 'scheme'],
  ['liberate', 'rattled'],
  ['win', 'defeated'],
  ['expand', 'smug'],
] as const

async function start(page: Page) {
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await page.waitForFunction(() => typeof (window as unknown as { cathnivorePell?: unknown }).cathnivorePell === 'function')
}

const portrait = (name: string) => (name === 'phone' ? '.papers-placard-face svg.exec-portrait' : '[data-rival] svg.exec-portrait')

test('Pell takes five poses from the table, each within 300 ms', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  await start(page)
  const sel = portrait(testInfo.project.name)
  await expect(page.locator(sel)).toBeVisible()
  const seen = new Set<string>()
  for (const [kind, pose] of EVENTS) {
    const ms = await page.evaluate(
      ([sel, kind, pose]) =>
        new Promise<number>((done) => {
          const t0 = performance.now()
          const check = () => (document.querySelector(sel)?.getAttribute('data-pell-pose') === pose ? done(performance.now() - t0) : requestAnimationFrame(check))
          ;(window as unknown as { cathnivorePell: (k: string) => void }).cathnivorePell(kind)
          check()
        }),
      [sel, kind, pose] as const,
    )
    expect(ms, kind).toBeLessThan(300)
    seen.add(pose)
  }
  expect(seen.size).toBe(5)
})

test('Pell\'s head is at least 90 px tall at D and 52 px on a phone', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  await start(page)
  const sel = portrait(testInfo.project.name)
  await expect(page.locator(sel)).toBeVisible()
  const h = await page.locator(sel).evaluate((svg) => {
    const a = svg.querySelector('.pell-hair')!.getBoundingClientRect()
    const b = svg.querySelector('.pell-face')!.getBoundingClientRect()
    return Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top)
  })
  expect(h).toBeGreaterThanOrEqual(testInfo.project.name === 'phone' ? 52 : 90)
})

test('reduced motion keeps only the fade', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'D')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page)
  const sel = portrait(testInfo.project.name)
  const s = await page.locator(sel).evaluate((svg) => ({
    head: getComputedStyle(svg.querySelector('.pell-head')!).transitionDuration,
    blink: getComputedStyle(svg.querySelector('.pell-blink')!).animationName,
    tie: getComputedStyle(svg.querySelector('.pell-tie')!).animationName,
    feat: getComputedStyle(svg.querySelector('.pell-feat')!).animationName,
  }))
  expect(s.head).toBe('0s')
  expect(s.blink).toBe('none')
  expect(s.tie).toBe('none')
  expect(s.feat).toBe('pell-feat-in')
})
