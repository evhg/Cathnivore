import { test, expect } from '@playwright/test'

// Plan item 35: the campaign screen is a map of Marrow. Won chapters free their regions; Cath stands at
// the next chapter; the map never scrolls the page sideways on a phone.
const KEY = 'cathnivore:campaign:v1'

test('a fresh campaign: nothing freed, Cath at chapter 1, no sideways scroll', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(page.locator('.cmp-map [data-region]')).toHaveCount(7)
  await expect(page.locator('.cmp-map [data-liberated="true"]')).toHaveCount(0)
  await expect(page.locator('.cmp-map-cath')).toHaveAttribute('data-at', 'fresh-meat')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
})

test('chapter 1 won: its regions are freed and Cath moves to chapter 2, across a reload', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })), KEY)
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(page.locator('.cmp-map [data-region="brindleHills"]')).toHaveAttribute('data-liberated', 'true')
  await expect(page.locator('.cmp-map [data-region="highmoor"]')).toHaveAttribute('data-liberated', 'true')
  await expect(page.locator('.cmp-map [data-region="saltmarsh"]')).toHaveAttribute('data-liberated', 'false')
  await expect(page.locator('.cmp-map-cath')).toHaveAttribute('data-at', 'word-of-mouth')
  await expect(page.getByRole('img', { name: /2 of 7 regions liberated/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(page.locator('.cmp-map-cath')).toHaveAttribute('data-at', 'word-of-mouth')
})

test('a map pin starts its chapter', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.locator('.cmp-pin').nth(1).click()
  await expect(page.locator('.scene')).toBeVisible()
})
