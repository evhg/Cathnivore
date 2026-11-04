import { expect, test } from '@playwright/test'

// Plan item 135: after a round that leaked, the stretch nothing covered glows (data-leak-stretch), a ghost of the
// tower Cath suggests stands on a free plot, a tap builds it, and her line on the field names what got through.
type HG = {
  game(): { towers: Array<{ col: number; row: number; kind: string }>; level: { cols: number; rows: number } }
  place(g: unknown, k: string, c: number, r: number): { ok: boolean }
  debrief(kind: string): void
  cathSay(): { text: string; box: { x: number; y: number; w: number; h: number }; empty: Array<{ x: number; y: number; w: number; h: number }> } | null
}

test('a leak gets a debrief: the bare stretch, a ghost tower on a free plot, and her line', async ({ page, hasTouch }) => {
  await page.goto('/hedgerow/?2d&sandbox=1')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?2d&sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  // Two towers at the lane's start, so the bare stretch is the rest of it.
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    let n = 0
    for (let r = 0; r < g.level.rows && n < 2; r++) for (let c = 0; c < g.level.cols && n < 2; c++) if (h.place(g, 'scarecrow', c, r).ok) n++
    document.getElementById('bubble')!.hidden = true
  })
  const line = async (kind: string) => {
    await page.evaluate((k) => (window as unknown as { hedgerow: HG }).hedgerow.debrief(k), kind)
    await expect(page.locator('#stage')).toHaveAttribute('data-leak-stretch', /\d+/)
    await expect(page.locator('.debrief-ghost')).toBeVisible()
    await expect(page.locator('#cath-say')).toBeVisible()
    return (await page.locator('#cath-say').textContent()) ?? ''
  }
  const a = await line('van')
  const b = await line('hatchback')
  expect(a).not.toBe(b)
  // The bubble keeps off the empty plots (item 120's bounds).
  const cover = await page.evaluate(() => {
    const s = (window as unknown as { hedgerow: HG }).hedgerow.cathSay()!
    const on = (q: typeof s.box, p: typeof s.box) => Math.max(0, Math.min(q.x + q.w, p.x + p.w) - Math.max(q.x, p.x)) * Math.max(0, Math.min(q.y + q.h, p.y + p.h) - Math.max(q.y, p.y))
    return s.empty.reduce((n, p) => n + on(s.box, p), 0) / (s.box.w * s.box.h)
  })
  expect(cover).toBeLessThanOrEqual(hasTouch ? 0.3 : 0.15)
  // A tap on the ghost builds the tower it shows.
  const kind = await page.locator('.debrief-ghost').getAttribute('data-kind')
  const before = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game().towers.length)
  await page.locator('.debrief-ghost').click()
  await expect(page.locator('.debrief-ghost')).toHaveCount(0)
  const after = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game().towers.map((t) => t.kind))
  expect(after.length).toBe(before + 1)
  expect(after.at(-1)).toBe(kind)
})
