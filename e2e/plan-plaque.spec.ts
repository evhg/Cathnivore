import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 531: on a desktop Hollowell's three moves sit on one acrylic-and-chrome plaque docked into Pell's
// medallion, with a tab that names the plan and quotes the looked-at move's slogan; every word on it is 13 px+ at
// AA, and focusing a move still marks exactly its targets (plan-strip covers the targets themselves).

async function start(page: Page, seed: string) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, seed)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
}

for (const [w, h] of [
  [1280, 800],
  [1440, 900],
] as const) {
  test(`the quarterly plan plaque at ${w}x${h}`, async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'a desktop layout')
    await page.setViewportSize({ width: w, height: h })
    for (const [seed, scheme] of [
      ['7', 'light'],
      ['21', 'dark'],
    ] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await start(page, seed)
      const strip = page.locator('.plan-strip[data-corp]')
      // the slab runs on under Pell's medallion: its right edge past the medallion's left edge
      const slab = await strip.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el, '::before')
        return { right: r.right - parseFloat(cs.right), content: cs.content }
      })
      expect(slab.content).not.toBe('none')
      const medallion = (await page.locator('.rival-frame').boundingBox())!
      expect(slab.right).toBeGreaterThan(medallion.x + 20)

      const tab = page.locator('.plan-plaque-tab')
      await expect(tab).toBeVisible()
      await expect(tab).toContainText('Quarterly Plan')
      // every word on the plaque at 13 px or more
      const small = await strip.evaluate((root) => {
        const out: string[] = []
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const el = walker.currentNode.parentElement!
          if (!walker.currentNode.textContent!.trim() || el.closest('.visually-hidden')) continue
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || !el.getBoundingClientRect().width) continue
          const fs = parseFloat(cs.fontSize)
          if (fs > 0 && fs < 12.95) out.push(`${walker.currentNode.textContent} ${fs}`)
        }
        return out
      })
      expect(small).toEqual([])
      // focusing a move: the tab quotes that move, and its targets are marked
      const expand = strip.locator('.plan-strip-item > button:first-child').nth(1)
      await expand.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(tab).toHaveAttribute('data-slot', 'expand')
      await expect(tab).toContainText('G. Pell')
      await expect(tab.locator('.plan-plaque-quote')).toHaveText(/^“.+”$/)
      const marked = await page.locator('.region-hex[data-threat="expand"]').count()
      const chips = await strip.locator('.plan-strip-item').nth(1).locator('.plan-strip-target-full .plan-chip:not(.plan-chip-enjoined)').count()
      expect(marked).toBe(chips)
      const axe = await new AxeBuilder({ page }).include('.plan-strip').withRules(['color-contrast']).analyze()
      expect(axe.violations).toEqual([])
    }
  })
}
