import { expect, test } from '@playwright/test'

// Plan item 503: the title's board previews the next chapter. About every 10 s the next unwon chapter's region
// flips green, holds and eases back while Cath points and names it; after a beat the board is the save's again.
// Under webdriver it runs only with `?attract`; reduced motion keeps a still highlight and animates nothing.
const boardHtml = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const map = document.querySelector('.title-board .map')!.cloneNode(true) as Element
    map.querySelectorAll('.title-movers').forEach((m) => m.remove())
    return map.innerHTML
  })

test('a beat previews the next chapter, then the board is the save again', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  test.setTimeout(60_000)
  await page.goto('/?attract')
  await page.locator('.title-board .map').waitFor()
  const rest = await boardHtml(page)
  const beat = page.locator('[data-attract-beat]')
  await expect(beat).toHaveAttribute('data-attract-beat', 'brindleHills', { timeout: 15_000 })
  const first = Date.now()
  await expect(page.locator('.title-cath[data-beat] .title-cath-line')).toHaveText('Brindle Hills next. Shall we?')
  await page.screenshot({ path: `e2e/screenshots/title-attract-${testInfo.project.name}-beat.png` })
  await expect(beat).toHaveCount(0, { timeout: 6000 })
  await expect(page.locator('.title-cath[data-beat]')).toHaveCount(0)
  expect(await boardHtml(page)).toBe(rest)
  // The next beat comes no sooner than 8 s after the first.
  await expect(beat).toHaveCount(1, { timeout: 15_000 })
  expect(Date.now() - first).toBeGreaterThanOrEqual(8000)
})

test('no beat under webdriver without ?attract, and none while the menu is in use', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'once')
  test.setTimeout(40_000)
  await page.goto('/')
  await page.waitForTimeout(3000)
  await expect(page.locator('[data-attract-beat]')).toHaveCount(0)
  await page.goto('/?attract')
  await page.getByRole('button', { name: /^Campaign/ }).hover()
  await page.waitForTimeout(5000)
  await expect(page.locator('[data-attract-beat]')).toHaveCount(0)
  await page.mouse.move(5, 5)
  await expect(page.locator('[data-attract-beat]')).toHaveCount(1, { timeout: 6000 })
})

test('reduced motion: a still highlight, nothing animated', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'once')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?attract')
  await expect(page.locator('[data-attract-still="brindleHills"]')).toHaveCount(1)
  await page.waitForTimeout(3500)
  await expect(page.locator('[data-attract-beat]')).toHaveCount(0)
  const running = await page.evaluate(() => document.getAnimations().filter((a) => {
    const t = (a.effect as KeyframeEffect | null)?.target as Element | null
    return !!t?.closest('.title-table') && a.playState === 'running'
  }).length)
  expect(running).toBe(0)
})

test('a beat costs no long task at 4x CPU throttle', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Chromium CDP')
  test.setTimeout(60_000)
  await page.goto('/?attract')
  await page.locator('.title-board .map').waitFor()
  await page.waitForLoadState('load')
  const cdp = await page.context().newCDPSession(page)
  await page.evaluate(() => {
    const w = window as unknown as { longTasks: number[] }
    w.longTasks = []
    new PerformanceObserver((list) => {
      // Only tasks while a beat starts or ends count (the beat's own work).
      for (const e of list.getEntries()) w.longTasks.push(e.duration)
    }).observe({ type: 'longtask' })
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await expect(page.locator('[data-attract-beat]')).toHaveCount(1, { timeout: 15_000 })
  await page.evaluate(() => ((window as unknown as { longTasks: number[] }).longTasks = []))
  await expect(page.locator('[data-attract-beat]')).toHaveCount(0, { timeout: 8000 })
  await expect(page.locator('[data-attract-beat]')).toHaveCount(1, { timeout: 15_000 })
  await page.waitForTimeout(400)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const tasks = await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks)
  expect(tasks.filter((d) => d > 50)).toEqual([])
})
