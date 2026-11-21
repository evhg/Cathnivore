import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 589: the desktop rail supports the table: at most four tagged sections (you, saving for, the ledger | log
// book), no readable text under 13 px, and the rail 22% of the screen or less; the book's tab is remembered.
for (const [width, height] of [[1440, 900], [1280, 800]] as const)
  test(`the desktop rail is four sections or fewer, 13 px type, 22% wide (${width}x${height})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the desktop rail')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.mouse.move(2, 2)
    await expect(page.locator('.desktop-col-left [data-rail-section="you"]')).toBeVisible()
    const m = await page.evaluate(() => {
      const rail = document.querySelector('.desktop-col-left')!
      const sections = [...rail.querySelectorAll('[data-rail-section]')].filter((e) => e.getBoundingClientRect().height > 0).length
      const small: string[] = []
      for (const e of rail.querySelectorAll<HTMLElement>('*')) {
        const r = e.getBoundingClientRect()
        if (r.width === 0 || r.height === 0 || e.closest('svg')) continue
        if (getComputedStyle(e).visibility === 'hidden') continue
        const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent!.trim()).map((n) => n.textContent!.trim()).join(' ')
        if (!own) continue
        const fs = parseFloat(getComputedStyle(e).fontSize)
        if (fs < 13) small.push(`${own.slice(0, 20)} ${fs}px`)
      }
      return { sections, small, share: rail.getBoundingClientRect().width / innerWidth }
    })
    expect(m.sections).toBeGreaterThan(0)
    expect(m.sections).toBeLessThanOrEqual(4)
    expect(m.small).toEqual([])
    expect(m.share).toBeLessThanOrEqual(0.22)
  })

test('the rail book opens on its last tab', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'the desktop rail')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('tab', { name: 'Log' }).click()
  await expect(page.locator('#rail-panel-log')).toBeVisible()
  await expect(page.locator('#rail-panel-ledger')).toBeHidden()
  await page.reload()
  await page.getByRole('button', { name: /Continue/ }).first().click()
  await expect(page.getByRole('tab', { name: 'Log' })).toHaveAttribute('aria-selected', 'true')
})
