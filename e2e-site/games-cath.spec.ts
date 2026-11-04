import { test, expect } from '@playwright/test'

// Plan item 108: each /games/ poster carries Cath in that game's dress, pose and mood: four distinct poses,
// each covering 15% or less of its card's art, and NIGHT SHIFT's in noir (greyscale, a red rim).
test("each game's poster has its own Cath, small beside the game's art", async ({ page }) => {
  await page.goto('/games/')
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'))
  await page.waitForTimeout(1000)
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.hero-game')].map((card) => {
      const cath = card.querySelector<HTMLElement>('.hero-game-cath')!
      const art = card.querySelector<HTMLElement>('.hero-game-art')!.getBoundingClientRect()
      const c = cath.getBoundingClientRect()
      const w = Math.max(0, Math.min(c.right, art.right) - Math.max(c.left, art.left))
      const h = Math.max(0, Math.min(c.bottom, art.bottom) - Math.max(c.top, art.top))
      return { pose: cath.dataset.pose, drawn: !!cath.querySelector('svg'), cover: (w * h) / (art.width * art.height), filter: getComputedStyle(cath).filter }
    }),
  )
  expect(cards).toHaveLength(4)
  expect(new Set(cards.map((c) => c.pose)).size).toBe(4)
  for (const c of cards) {
    expect(c.drawn).toBe(true)
    expect(c.cover, c.pose).toBeLessThanOrEqual(0.15)
  }
  expect(cards[3]!.filter).toContain('grayscale(1)')
})
