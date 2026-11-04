import { test, expect } from '@playwright/test'

// Plan item 110: Cath's title line is her speech bubble: 15 px or more, its tail within 24 px of her head, and the
// bubble over none of her face.
test("Cath's title line is a bubble at her head", async ({ page }) => {
  await page.goto('/')
  await page.locator('.title-cath .cath-head').waitFor()
  await page.waitForTimeout(600)
  const m = await page.evaluate(() => {
    const line = document.querySelector<HTMLElement>('.title-art .title-cath-line')!
    const b = line.getBoundingClientRect()
    const head = document.querySelector('.title-cath .cath-head')!.getBoundingClientRect()
    const face = document.querySelector('.title-cath .cath-features')!.getBoundingClientRect()
    const tail = getComputedStyle(line, '::after')
    const tl = b.left + parseFloat(tail.left)
    const tt = b.bottom - parseFloat(tail.bottom) - parseFloat(tail.height)
    // The tip is the lowest corner of the clip-path triangle: 30% across at D, the left corner on a phone.
    const tip = { x: tl + parseFloat(tail.width) * (innerWidth > 600 ? 0.3 : 0), y: tt + parseFloat(tail.height) }
    const dx = Math.max(head.left - tip.x, 0, tip.x - head.right)
    const dy = Math.max(head.top - tip.y, 0, tip.y - head.bottom)
    const overlap = b.left < face.right && face.left < b.right && b.top < face.bottom && face.top < b.bottom
    return { size: parseFloat(getComputedStyle(line).fontSize), gap: Math.hypot(dx, dy), overlap, tail: tail.content }
  })
  expect(m.size).toBeGreaterThanOrEqual(15)
  expect(m.tail).not.toBe('none')
  expect(m.gap).toBeLessThanOrEqual(24)
  expect(m.overlap).toBe(false)
})
