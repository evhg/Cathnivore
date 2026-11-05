import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 166: the bugs from the 2026-11-05 16:05 critique (Cathnivore's share).

type Box = { left: number; top: number; right: number; bottom: number }
const meets = (a: Box, b: Box) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
const boxOf = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((e) => {
    const r = e.getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  })

test("the desktop hand's suggestion leaf stays on its own card, clear of its neighbours and its 'i'", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '21')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.table-hand .suggest-leaf').waitFor()
  const r = await page.evaluate(() => {
    const box = (e: Element) => {
      const b = e.getBoundingClientRect()
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }
    }
    const leaf = document.querySelector('.table-hand .suggest-leaf')!
    const own = leaf.closest('.action-item')!
    const others = [...document.querySelectorAll('.table-hand .action-item')].filter((c) => c !== own).map(box)
    return { leaf: box(leaf), others, info: box(own.querySelector('.tooltip-trigger') ?? own) }
  })
  for (const o of r.others) expect(meets(r.leaf, o)).toBe(false)
  expect(meets(r.leaf, r.info)).toBe(false)
})

test('the desktop title keeps its crates off the menu board and the NEXT card on the table', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.locator('.ritual-card').waitFor()
    const crates = await boxOf(page, '.title-prop-crates')
    const menu = await boxOf(page, '.title-menu')
    expect(meets(crates, menu)).toBe(false)
    const card = await boxOf(page, '.ritual-card')
    const table = await boxOf(page, '.title-table-props')
    expect(card.top).toBeGreaterThanOrEqual(table.top)
    expect(card.bottom).toBeLessThanOrEqual(height)
  }
})

test("the phone title's Daily slip stays off the board and Cath's figure, on two lines", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.daily-ritual.is-compact .ritual-receipt').waitFor()
  const slip = await boxOf(page, '.daily-ritual.is-compact .ritual-receipt')
  const board = await boxOf(page, '.title-board')
  expect(meets(slip, board)).toBe(false)
  expect(slip.bottom - slip.top).toBeLessThanOrEqual(52)
  expect(slip.left).toBeGreaterThanOrEqual(0)
})
