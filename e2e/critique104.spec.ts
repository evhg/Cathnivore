import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 104: the bugs from the 2026-11-04 14:10 critique (Cathnivore's share).

async function start(page: Page, seed: string) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, seed)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
}

test("a desktop 'Not yet' strip names its card whole at 1280x800, without 'Scheme: '", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  for (const seed of ['21', '3']) {
    await start(page, seed)
    const report = await page.evaluate(() => {
      const labels = [...document.querySelectorAll<HTMLElement>('.actions-sheet .action-item > button:disabled .action-label')]
      return {
        cut: labels.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.textContent),
        scheme: labels
          .map((e) => [...e.childNodes].filter((n) => !(n instanceof HTMLElement && n.classList.contains('visually-hidden'))).map((n) => n.textContent).join(''))
          .filter((t) => t.includes('Scheme:')),
        n: labels.length,
      }
    })
    expect(report.n).toBeGreaterThan(0)
    expect(report.cut).toEqual([])
    expect(report.scheme).toEqual([])
  }
})

test("a phone hand's why-not chip is never cut", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const seed of ['7', '21', '3']) {
    await start(page, seed)
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.action-tray .action-why-not')]
        .filter((e) => e.getBoundingClientRect().width > 2)
        .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)
        .map((e) => e.textContent),
    )
    expect(cut).toEqual([])
  }
})
