import { test, expect, type Page } from '@playwright/test'

// Plan item 753: choosing a chapter draws the road from Cath's stop to it (the reveal mask's dash offset runs 1 -> 0
// over 600 ms); reduced motion fades the road in instead.
const KEY = 'cathnivore:campaign:v1'

async function open(page: Page) {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })), KEY)
  await page.goto('/')
  await page.getByText('Campaign', { exact: false }).first().click()
  await expect(page.locator('.cmp-map-cath')).toBeVisible()
}

async function choose(page: Page, phone: boolean, n: number) {
  if (phone) await page.locator('.cmp-tab').nth(n).click()
  else await page.locator('.cmp-path > .cmp-stop').nth(n).locator('.cmp-card').hover()
}

const offset = (page: Page) => page.locator('.cmp-route-reveal').evaluate((e) => parseFloat(getComputedStyle(e).strokeDashoffset))

test('choosing a chapter draws the road from Cath to it', async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  test.skip(!phone && info.project.name !== 'desktop-chromium', 'phone and desktop')
  await open(page)
  // at rest Cath stands at the next chapter's stop: no road to draw
  if (phone) await expect(page.locator('.cmp-map-route')).toHaveCount(0)
  await choose(page, phone, 4)
  const route = page.locator('.cmp-map-route')
  await expect(route).toHaveAttribute('data-to', /.+/)
  const a = await offset(page)
  await page.waitForTimeout(120)
  const b = await offset(page)
  expect(a).not.toBe(b)
  await expect.poll(() => offset(page)).toBeLessThan(0.001)
  // a different choice draws afresh
  await choose(page, phone, 3)
  await expect(route).toHaveAttribute('data-to', 'the-plan')
  expect(await offset(page)).toBeGreaterThan(0.05)
})

test('reduced motion fades the road in, no draw', async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  test.skip(!phone && info.project.name !== 'desktop-chromium', 'phone and desktop')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await choose(page, phone, 4)
  await expect(page.locator('.cmp-map-route')).toHaveCount(1)
  expect(await offset(page)).toBe(0)
  expect(await page.locator('.cmp-route-ink').evaluate((e) => getComputedStyle(e).animationName)).toBe('cmp-route-fade')
})
