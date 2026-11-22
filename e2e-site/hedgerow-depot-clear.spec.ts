import { expect, test } from '@playwright/test'

// Plan item 661: what lays itself over the field's edge keeps off Hollowell's depots. On level 34 the round's banner
// ('Round 17: The wall') sat over a phone's top depot and Cath's pie tip over the lower depot at D.
const stars = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }

test("level 34's round banner and Cath's tip meet no depot", async ({ page }) => {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(([st, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 34: true }, tips: t })), [stars, tips] as const)
  await page.goto('/hedgerow/?sandbox=1&level=34&2d')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game: () => unknown } }).hedgerow?.game(), null, { timeout: 60_000 })
  await page.waitForTimeout(1000)
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: { game: () => { wave: number }; sendWave: (g: unknown, b: boolean) => void } }).hedgerow
    const g = hg.game()
    g.wave = 16
    hg.sendWave(g, true)
  })
  const overlaps = (sel: string) =>
    page.evaluate((q) => {
      const el = document.querySelector<HTMLElement>(q)
      if (!el || el.hidden || !el.getBoundingClientRect().width) return null
      const r = el.getBoundingClientRect()
      return [...document.querySelectorAll('.depot')].map((d) => d.getBoundingClientRect()).filter((d) => d.width && d.left < r.right && r.left < d.right && d.top < r.bottom && r.top < d.bottom).length
    }, sel)
  await expect.poll(() => overlaps('.banner.show.round'), { timeout: 5000 }).not.toBeNull()
  expect(await overlaps('.banner.show.round')).toBe(0)
  // her tip on the pie, when it comes up with the round
  const bubble = await expect.poll(() => overlaps('#bubble'), { timeout: 5000 }).not.toBeNull().then(() => true, () => false)
  if (bubble) {
    await page.waitForTimeout(500) // its pop-in
    expect(await overlaps('#bubble')).toBe(0)
  }
})
