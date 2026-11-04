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

  test('at 844x390 every tray card shows its whole name', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(() => {
      const stars = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i + 1), 3]))
      const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 12: true }, tips }))
    })
    await page.goto('/hedgerow/?sandbox=1&2d&level=12')
    await expect(page.locator('.tray-name').first()).toBeVisible()
    const cut = await page.locator('.tray-name').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent))
    expect(cut).toEqual([])
  })

  test('at 844x390 the round ticket shows its whole "of N"', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(() => {
      const stars = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i + 1), 3]))
      const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 12: true }, tips }))
    })
    await page.goto('/hedgerow/?sandbox=1&2d&level=12')
    const stub = page.locator('.round-ticket .ticket-stub').first()
    await expect(stub).toBeVisible()
    await expect(page.locator('.round-ticket .ticket-of').first()).toHaveText(/of \d+/)
    const bad = await stub.evaluate((s) => {
      const box = s.getBoundingClientRect()
      return [...s.querySelectorAll<HTMLElement>('.ticket-label, .ticket-no, .ticket-of')].filter((e) => {
        const r = e.getBoundingClientRect()
        return e.scrollWidth > e.clientWidth + 1 || r.left < box.left - 1 || r.right > box.right + 1 || r.right > innerWidth
      }).map((e) => e.className)
    })
    expect(bad).toEqual([])
  })

  for (const level of [12, 25, 30]) {
    test(`at 1440x900 level ${level}'s side column ends on a whole card and the tray is one row`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/hedgerow/?sandbox=1&2d')
      await page.evaluate((lvl) => {
        const stars = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), 3]))
        const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
        localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [lvl]: true }, tips }))
      }, level)
      await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
      // Plan item 87: Coming up is the tabbed card's first tab; on a round too long for the column (level 25's five
      // vehicle groups beside ten seed packets) the card gives way and the column ends on the whole round ticket.
      await expect(page.locator('.play .panel .round-ticket')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(200)
      const r = await page.evaluate(() => {
        const p = document.querySelector<HTMLElement>('.play .panel')!
        const last = [...p.children].reverse().find((c) => c.getClientRects().length > 0)!
        const foot = p.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom)
        const tops = [...document.querySelectorAll<HTMLElement>('.play .controls > :is(.ability, .auto-btn)')]
          .filter((b) => !b.hidden)
          .map((b) => Math.round(b.getBoundingClientRect().top))
        return { overBy: Math.round(last.getBoundingClientRect().bottom - foot), gap: Math.round(foot - last.getBoundingClientRect().bottom), spread: Math.max(...tops) - Math.min(...tops), tabs: last.matches('.field-tabs') }
      })
      expect(r.overBy).toBeLessThanOrEqual(1)
      // the tabbed card runs to the foot: no empty band (a whole ticket that ends the column leaves less than its tabs)
      expect(r.gap).toBeLessThanOrEqual(r.tabs ? 2 : 96)
      expect(r.spread).toBeLessThan(20) // one row (a wrapped row sits 80 px lower)
    })
  }

  for (const outcome of ['won', 'lost'] as const) {
    test(`at 844x390 the ${outcome} end card keeps its stats and rewards on the card`, async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 })
      await page.goto('/hedgerow/?sandbox=1&2d&level=3')
      await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game())
      for (let i = 0; i < 8 && !(await page.locator('#screen-play:visible').count()); i++) {
        await page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first().click().catch(() => {})
        await page.waitForTimeout(300)
      }
      await page.evaluate((o) => {
        ;(window as unknown as { hedgerow: { game(): { phase: string } } }).hedgerow.game().phase = o
      }, outcome)
      await expect(page.locator('#dlg-result[open]')).toBeVisible()
      await page.waitForTimeout(1800) // the tally rolls up
      const off = await page.evaluate(() => {
        const d = document.querySelector('#dlg-result')!
        const box = d.getBoundingClientRect()
        const acts = d.querySelector('.win-actions')!.getBoundingClientRect()
        return [...d.querySelectorAll<HTMLElement>('#result-stats, .tally-counts, .tally-head, #result-note')]
          .filter((e) => e.getClientRects().length && e.textContent!.trim())
          .filter((e) => {
            const r = e.getBoundingClientRect()
            return r.top < box.top || r.bottom > Math.min(box.bottom, acts.top) + 1
          })
          .map((e) => e.className || e.id)
      })
      expect(off).toEqual([])
    })
  }
})
