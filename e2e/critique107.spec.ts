import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 107: the bugs from the 2026-11-04 14:55 critique (Cathnivore's share).

async function start(page: Page, seed: string) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, seed)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
}

test("a why-not reason keeps the space after 'Need' ('Need 4 more Marks', not 'Need4')", async ({ page }) => {
  for (const seed of ['21', '3']) {
    await start(page, seed)
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.action-why-not')].filter((e) => e.getBoundingClientRect().width > 2).map((e) => e.innerText),
    )
    expect(texts.length).toBeGreaterThan(0)
    expect(texts.filter((t) => /Need\S|\Sto remove/.test(t))).toEqual([])
  }
})
