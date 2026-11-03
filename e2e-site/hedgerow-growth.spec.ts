import { expect, test, type Page } from '@playwright/test'

// Plan item 59: the field grows through the level. On level 13 the ripe-plot count rises from round 1 to the last
// round, a leak sets one plot back a stage, and a win shows the harvest on the field before the result card.
type Hg = { game(): { paid: number; leaks?: number; phase: string; level: { waves: unknown[] } } }
const hg = (page: Page) => page.evaluate.bind(page)

async function open(page: Page): Promise<void> {
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  const stars = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 3]))
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 13: true }, tips: t })), [stars, tips] as const)
  await page.goto('/hedgerow/?sandbox=1&2d&level=13')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: Hg }).hedgerow?.game(), null, { timeout: 60_000 })
  for (let i = 0; i < 8 && !(await page.locator('#screen-play:visible').count()); i++) {
    await page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first().click().catch(() => {})
    await page.waitForTimeout(300)
  }
}

const setPaid = (page: Page, which: 'first' | 'mid' | 'last') =>
  hg(page)((w) => {
    const g = (window as unknown as { hedgerow: Hg }).hedgerow.game()
    const n = g.level.waves.length
    g.paid = w === 'first' ? 0 : w === 'mid' ? Math.floor(n / 2) + 3 : n - 1
  }, which)

const field = (page: Page) => page.locator('[data-crop-sig]').first()

test('the ripe plots grow from round 1 to the last round of level 13', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page)
  await setPaid(page, 'first')
  await expect(field(page)).toHaveAttribute('data-ripe', '0')
  await setPaid(page, 'last')
  await expect.poll(async () => Number(await field(page).getAttribute('data-ripe'))).toBeGreaterThan(4)
})

test('a leak tramples one plot back a stage', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page)
  await setPaid(page, 'mid')
  await page.waitForTimeout(300)
  const before = (await field(page).getAttribute('data-crop-sig'))!
  await page.evaluate(() => {
    const g = (window as unknown as { hedgerow: Hg }).hedgerow.game()
    g.leaks = (g.leaks ?? 0) + 1
  })
  await expect(field(page)).not.toHaveAttribute('data-crop-sig', before)
  const after = (await field(page).getAttribute('data-crop-sig'))!
  const diffs = [...before].map((c, i) => [c, after[i]] as const).filter(([a, b]) => a !== b)
  expect(diffs).toHaveLength(1)
  expect(Number(diffs[0]![1])).toBe(Number(diffs[0]![0]) - 1)
})

test('a win shows the harvest on the field before the payout', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page)
  await setPaid(page, 'last')
  await page.evaluate(() => {
    const g = (window as unknown as { hedgerow: Hg }).hedgerow.game()
    g.paid = g.level.waves.length
    g.phase = 'won'
  })
  await expect(page.locator('.harvest')).toBeAttached({ timeout: 5_000 })
  expect(await page.locator('#dlg-result[open]').count()).toBe(0)
  await expect(page.locator('.harvest .harvest-cath')).toBeVisible()
  await expect(field(page)).toHaveAttribute('data-harvest', '1')
  await expect(page.locator('#dlg-result[open]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.harvest')).toHaveCount(0)
  // Every empty plot ripe once the harvest has crossed the field.
  const sig = (await field(page).getAttribute('data-crop-sig'))!
  expect([...sig].every((c) => c === '3' || c === 'x')).toBe(true)
})
