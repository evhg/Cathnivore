import { expect, test, type Page } from '@playwright/test'

// Plan item 170: the lesson framed close with Cath beside it. At D its tiles span 55% or more of the valley; at P
// and D her bubble's tail ends within 40 px of her figure (on a phone it left the card above the valley); a ring
// breaks on each tile the water reaches; then the daily board shows within 1.5 s in the same page, pulling back
// (cut under reduced motion).
const tailGap = (page: Page) =>
  page.evaluate(() => {
    const say = document.getElementById('valley-say')!
    const cath = document.getElementById('valley-cath')!.getBoundingClientRect()
    const b = say.getBoundingClientRect()
    const v = (n: string) => parseFloat(say.style.getPropertyValue(n))
    const a = v('--tail-a')
    const x = b.left + v('--tail-x') + Math.cos(a) * v('--tail-len')
    const y = b.top + v('--tail-y') + Math.sin(a) * v('--tail-len')
    return Math.hypot(Math.max(cath.left - x, 0, x - cath.right), Math.max(cath.top - y, 0, y - cath.bottom))
  })

test('the lesson is framed close, her bubble by her, then the daily pulls back into view', async ({ page }, info) => {
  await page.goto('/runnel/?lesson')
  await page.waitForSelector('#board .tiles > g.cell.lesson-target')
  const say = page.locator('#valley-say')
  await expect(say).toBeVisible({ timeout: 5_000 })
  await expect(say).toContainText("Hi, I'm Cath")
  expect(await tailGap(page)).toBeLessThanOrEqual(40)
  if (!info.project.name.includes('phone')) {
    const ratio = await page.evaluate(() => {
      const st = document.querySelector('.stage')!.getBoundingClientRect()
      const ts = [...document.querySelectorAll('#board polygon.tile')].map((t) => t.getBoundingClientRect())
      return (Math.max(...ts.map((t) => t.right)) - Math.min(...ts.map((t) => t.left))) / st.width
    })
    expect(ratio).toBeGreaterThanOrEqual(0.55)
  }
  const url = page.url()
  await page.locator('#board .tiles > g.cell.lesson-target').click()
  await expect(page.locator('#board .lesson-ring')).not.toHaveCount(0)
  for (let i = 0; i < 2; i++) await page.locator('#board .tiles > g.cell.lesson-target').click()
  const t0 = Date.now()
  await expect(page.locator('#board .tiles > g.cell')).not.toHaveCount(4, { timeout: 1_500 })
  expect(Date.now() - t0).toBeLessThanOrEqual(1_500)
  expect(page.url()).toBe(url)
  await expect(page.locator('#board')).toHaveClass(/pull-back/)
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('the pull-back cuts', async ({ page }) => {
    await page.goto('/runnel/?lesson')
    await page.waitForSelector('#board .tiles > g.cell.lesson-target')
    for (let i = 0; i < 3; i++) await page.locator('#board .tiles > g.cell.lesson-target').click()
    await expect(page.locator('#board .tiles > g.cell')).not.toHaveCount(4, { timeout: 1_500 })
    expect(await page.locator('#board').evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
  })
})
