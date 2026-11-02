import { expect, test, type Page } from '@playwright/test'

// Plan item 40 (Hedgerow half): bugs from the 2026-11-02 critique, each checked where it broke.
const URL = '/hedgerow/?2d'
const seenAll = { 'hedgerow-intro': true, intro: true, how: true }

async function withSave(page: Page, stars: Record<string, number>): Promise<void> {
  await page.goto(URL)
  await page.evaluate(
    ([s, seen]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: {}, seen, tips: {}, bank: {} })),
    [stars, seenAll] as const,
  )
  await page.reload()
  await expect(page.locator('button.node.next')).toBeVisible()
}

test.describe('Hedgerow critique fixes (plan item 40)', () => {
  test("on a fresh farm Cath's map line sits clear of the glass header", async ({ page }) => {
    await withSave(page, {})
    const r = await page.evaluate(() => ({
      head: document.querySelector('#screen-select > header')!.getBoundingClientRect().bottom,
      line: document.querySelector('#host-line')!.getBoundingClientRect().top,
    }))
    expect(r.line).toBeGreaterThanOrEqual(r.head)
  })

  test('"Start here" shows only on a fresh farm; mid-campaign the next level says Next', async ({ page }) => {
    await withSave(page, {})
    await expect(page.locator('button.node.next .start-tag')).toHaveText('Start here')
    await withSave(page, { '1': 3, '2': 2, '3': 1 })
    await expect(page.locator('button.node.next .start-tag')).toHaveText('Next')
  })

  test("the story's name plate is whole and on top of the figures", async ({ page }) => {
    await withSave(page, {})
    await page.locator('button.node.next').click()
    await expect(page.locator('#dlg-story')).toBeVisible()
    for (let i = 0; i < 2; i++) {
      await page.waitForTimeout(900) // the actor's entrance and the band's wipe
      const r = await page.locator('#story-who').evaluate((el) => {
        const b = el.getBoundingClientRect()
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
        return {
          inView: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
          clipped: el.scrollWidth > el.clientWidth + 1,
          onTop: !!hit && (hit === el || el.contains(hit)),
        }
      })
      expect(r).toEqual({ inView: true, clipped: false, onTop: true })
      await page.locator('#dlg-story').getByRole('button', { name: 'Next' }).click()
    }
  })
})
