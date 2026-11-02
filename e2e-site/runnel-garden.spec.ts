import { test, expect, type Page } from '@playwright/test'

// Plan item 37: Runnel's art is all authored as code. No platform emoji in its rendered text at P or D,
// with a save that fills Bea's garden (every stage, a visitor, both event crops).
const PICTO = /\p{Extended_Pictographic}/u

async function seed(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const results: Record<string, unknown> = {}
    for (let i = 1; i < 20; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      results[d] = { number: 100 - i, timeMs: 60000, taps: 10 + (i % 3), par: 11 }
    }
    const orchard = { 1: { drops: 2, taps: 9, timeMs: 30000 } }
    localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results, bestPractice: {}, practiceSolved: 3, seenHelp: true, eventCrops: ['autumn-2026', 'spring-2026'], orchard }))
  })
}

async function noEmoji(page: Page, where: string): Promise<void> {
  const text = await page.evaluate(() => document.body.innerText)
  expect(text.match(new RegExp(PICTO.source, 'gu')) ?? [], where).toEqual([])
}

test('Bea\'s garden is drawn, and no screen shows a platform emoji', async ({ page }) => {
  await seed(page)
  await page.goto('/runnel/?nohelp')
  await noEmoji(page, 'board')
  await page.locator('#btn-stats').click()
  await expect(page.locator('#garden .plot').first()).toBeVisible()
  // Every plot is a drawing at its stage; the event crops and the visitor too.
  const plots = await page.locator('#garden .plot').count()
  await expect(page.locator('#garden .plot svg.ga')).toHaveCount(plots)
  for (const stage of ['sprout', 'growing', 'ripe']) expect(await page.locator(`#garden svg.ga-${stage}`).count(), stage).toBeGreaterThan(0)
  await expect(page.locator('#garden .exclusive svg.ga-event')).toHaveCount(2)
  await expect(page.locator('#garden-note .garden-visitor svg')).toHaveCount(1)
  await noEmoji(page, 'stats and garden')
  await page.keyboard.press('Escape')
  await page.goto('/runnel/?nohelp&mode=orchard')
  await noEmoji(page, 'orchard')
})

test('the Orchard is rows of trees: no sideways overflow, and the open trees are reachable by keyboard', async ({ page }) => {
  await page.addInitScript(() => {
    const orchard = { 1: { drops: 3, taps: 9, timeMs: 30000 }, 2: { drops: 2, taps: 14, timeMs: 30000 } }
    localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results: {}, bestPractice: {}, practiceSolved: 0, seenHelp: true, orchard }))
  })
  await page.goto('/runnel/?nohelp&mode=orchard')
  const levels = page.locator('#levels')
  await expect(levels.locator('button')).toHaveCount(30)
  expect(await levels.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  await expect(levels.locator('svg.ga-tree.is-fruit')).toHaveCount(1)
  await expect(levels.locator('svg.ga-tree.is-blossom')).toHaveCount(1)
  await expect(levels.locator('svg.ga-tree.is-locked')).toHaveCount(27)
  await expect(levels.locator('[aria-current="true"] .tree-cath')).toHaveCount(1)
  // Keyboard: focus the first tree, Tab to the second, Enter plays it.
  await levels.locator('button').first().focus()
  await page.keyboard.press('Tab')
  await expect(levels.locator('button').nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(levels.locator('button').nth(1)).toHaveAttribute('aria-current', 'true')
})
