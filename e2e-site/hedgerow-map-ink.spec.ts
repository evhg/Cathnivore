import { expect, test } from '@playwright/test'

// Plan item 406: the act map shows progress. A seeded save (four fields won) shows the three stop states, told apart
// by computed style, and the road is inked in from the act's start to the next field's coin, no further.
test('the act map: won, next and locked stops differ, and the road is inked to the next field', async ({ page }) => {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: { 1: 3, 2: 2, 3: 3, 4: 1 }, seenBefore: { 1: true, 2: true, 3: true, 4: true, 5: true }, tips: { all: true } })))
  await page.goto('/hedgerow/?2d')
  const act = page.locator('li.act').first()
  await expect(act.locator('.stop[data-state="won"]')).toHaveCount(4)
  await expect(act.locator('.stop[data-state="next"]')).toHaveCount(1)
  await page.waitForTimeout(1200)
  const r = await act.evaluate((li) => {
    const look = (sel: string) => {
      const s = li.querySelector<HTMLElement>(`${sel} .level-num`)!
      const cs = getComputedStyle(s)
      return `${cs.backgroundColor}|${cs.backgroundImage}|${cs.filter}|${cs.borderColor}`
    }
    const svg = li.querySelector<SVGSVGElement>('.trail-path')!
    const walked = svg.querySelector<SVGPathElement>('.lane-walked')!
    const bed = svg.querySelector<SVGPathElement>('.lane-bed')!
    const end = walked.getPointAtLength(walked.getTotalLength())
    const m = walked.getScreenCTM()!
    const at = { x: end.x * m.a + end.y * m.c + m.e, y: end.x * m.b + end.y * m.d + m.f }
    const coin = li.querySelector('.stop[data-state="next"] .level-num')!.getBoundingClientRect()
    return {
      won: look('.stop[data-state="won"]'),
      next: look('.stop[data-state="next"]'),
      locked: look('.stop:has(> .node:disabled)'),
      inked: getComputedStyle(walked).stroke !== getComputedStyle(bed).stroke && parseFloat(getComputedStyle(walked).strokeWidth) >= parseFloat(getComputedStyle(bed).strokeWidth),
      miss: Math.hypot(at.x - (coin.left + coin.width / 2), at.y - (coin.top + coin.height / 2)),
      walkedShorter: walked.getTotalLength() < bed.getTotalLength() - 20,
    }
  })
  expect(new Set([r.won, r.next, r.locked]).size, JSON.stringify(r)).toBe(3)
  expect(r.inked).toBe(true)
  expect(r.miss, 'the inked road ends on the next field').toBeLessThanOrEqual(6)
  expect(r.walkedShorter).toBe(true)
})
