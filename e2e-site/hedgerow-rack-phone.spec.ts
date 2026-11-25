import { expect, test, type Page } from '@playwright/test'

// Plan item 698: on an upright phone the seed rack is full (no blank strip: a whole first packet was faded as 'cut'
// by its own tilt, and the gap before the More arrow is the next packet peeking), every unlocked seed comes into
// view by swiping, and Cath is at hand as a chip at the rack's left that opens her post.
type HG = { game: () => { level: { towers: string[] } }; sendWave: (g: unknown, forced?: boolean) => unknown }
const hg = (page: Page) => page.evaluate(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game())

async function inRound(page: Page) {
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
  const stars = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [String(i + 1), 3]))
  await page.goto('/hedgerow/?2d')
  await page.evaluate(([st, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 27: true }, tips: t })), [stars, tips] as const)
  await page.goto('/hedgerow/?2d&sandbox=1&level=27')
  await expect.poll(() => hg(page), { timeout: 30_000 }).toBe(true)
  await page.evaluate(() => { const h = (window as unknown as { hedgerow: HG }).hedgerow; h.sendWave(h.game(), true) })
  // a new vehicle's field-guide page holds the round until it's closed; her docked line, when up, folds away mid-round
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500)
    await page.evaluate(() => document.querySelector<HTMLElement>('.intro:not([hidden]) .intro-go')?.click())
  }
  await expect(page.locator('.cath-dock')).toBeHidden({ timeout: 15_000 })
}

test('plan item 698: the phone rack has no blank strip, every seed swipes into view, and Cath is a chip at its left', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'upright phone rack')
  await inRound(page)
  const chip = page.locator('.tray-wrap > .cath-chip')
  await expect(chip).toBeVisible()
  const cb = (await chip.boundingBox())!
  expect(cb.width).toBeGreaterThanOrEqual(54)
  expect(cb.height).toBeGreaterThanOrEqual(54)
  await expect(chip).toHaveAttribute('data-level', /^\d+$/)

  // No empty strip over 24 px from the rack's left edge to the More arrow: the chip, then whole packets, then the
  // next one peeking.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  const gaps = await page.evaluate(() => {
    const wrap = document.querySelector('.tray-wrap')!.getBoundingClientRect()
    const more = document.querySelector<HTMLElement>('.tray-more:not([hidden])')?.getBoundingClientRect()
    const shown = [...document.querySelectorAll<HTMLElement>('.tray-wrap > .cath-chip, .tray > *')]
      .filter((e) => e.getClientRects().length > 0 && Number(getComputedStyle(e).opacity) > 0.5 && getComputedStyle(e).visibility !== 'hidden')
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.right > wrap.left && b.left < wrap.right)
      .sort((a, b) => a.left - b.left)
    const out: number[] = []
    let x = wrap.left
    for (const b of shown) {
      out.push(b.left - x)
      x = Math.max(x, b.right)
    }
    out.push((more ? more.left : wrap.right) - x)
    return out
  })
  expect(Math.max(...gaps), `gaps ${gaps.map(Math.round).join(',')}`).toBeLessThanOrEqual(24)

  // Every packet in the rack is wholly shown at some point as the rack is swiped along.
  const seen = new Set<string>()
  const total = await page.locator('.tray > .tray-tower').count()
  expect(total).toBe(await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game().level.towers.length))
  for (let i = 0; i < 20 && seen.size < total; i++) {
    for (const n of await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.tray > .tray-tower')].filter((e) => !e.classList.contains('tray-cut') && !e.classList.contains('tray-peek')).map((e) => e.querySelector('.tray-name')?.textContent ?? ''))) seen.add(n)
    const t = (await page.locator('.tray-wrap .tray').boundingBox())!
    await page.mouse.move(t.x + t.width * 0.8, t.y + t.height / 2)
    await page.evaluate(() => document.querySelector('.tray-wrap .tray')!.scrollBy({ left: 120 }))
    await page.waitForTimeout(250)
  }
  expect(seen.size).toBe(total)

  // A tap on the chip opens her post (between rounds) or her status (in a round).
  await chip.tap()
  await expect(page.locator('.banner.small.show')).toContainText(/Cath/)
})
