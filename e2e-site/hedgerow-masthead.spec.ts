import { expect, test } from '@playwright/test'

// Plan item 487: the act map's masthead is farm-gate signage. At D the wordmark is a painted board centred on the
// header (within 4 px) and no key plaque passes behind it; on a phone every key stays a 44 px target with a name.
test('the act map masthead: a centred gate board, keys clear of it, every key a named 44 px target', async ({ page, hasTouch }) => {
  // a player some way in, so every key shows (Cath's and the Daily open with the first stars)
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [String(i + 1), 3])), tips: { all: true } })))
  await page.goto('/hedgerow/?2d')
  const top = page.locator('#screen-select > .top')
  await expect(top).toHaveAttribute('data-masthead', 'gate')
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const b = document.querySelector('#screen-select .wordmark')!.getBoundingClientRect()
    const keys = [...document.querySelectorAll<HTMLElement>('#screen-select .top-tools .bank-btn')].filter((k) => !k.hidden && !k.closest('.tools-drawer') && k.getClientRects().length > 0)
    return {
      centre: b.left + b.width / 2,
      vw: innerWidth,
      board: [b.left, b.right, b.top, b.bottom] as [number, number, number, number],
      keys: keys.map((k) => {
        const r = k.getBoundingClientRect()
        return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, name: (k.getAttribute('aria-label') || k.textContent || '').trim() }
      }),
    }
  })
  expect(m.keys.length).toBeGreaterThanOrEqual(5)
  for (const k of m.keys) {
    expect(k.name.length, JSON.stringify(k)).toBeGreaterThan(0)
    expect(k.w, JSON.stringify(k)).toBeGreaterThanOrEqual(44)
    expect(k.h, JSON.stringify(k)).toBeGreaterThanOrEqual(44)
  }
  if (!hasTouch && m.vw >= 1100) {
    expect(Math.abs(m.centre - m.vw / 2)).toBeLessThanOrEqual(4)
    const [l, r, t, b] = m.board
    for (const k of m.keys) expect(k.r <= l || k.l >= r || k.b <= t || k.t >= b, `key ${k.name} clear of the board`).toBe(true)
  }
})
