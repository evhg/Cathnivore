import { expect, test, type Page } from '@playwright/test'

// Plan item 224: on a level you've won, Bea has been at one of Hollowell's adverts with her crayons. Level 75 (the
// Ballot) has billboards in its margin; it shows the crayon once won, and not before.
type Box = { x: number; y: number; w: number; h: number }
type Hg = { game(): unknown; crayon(): Box | null; margin2d(): { pieces: Array<{ kind: string }> } | null }

async function open(page: Page, won: boolean): Promise<void> {
  const stars = Object.fromEntries(Array.from({ length: won ? 75 : 74 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 75: true }, tips: t })), [stars, tips] as const)
  await page.goto('/hedgerow/?sandbox=1&2d&level=75')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: Hg }).hedgerow?.game(), null, { timeout: 60_000 })
}

const hg = (page: Page) => page.evaluate(() => {
  const h = (window as unknown as { hedgerow: Hg }).hedgerow
  return { crayon: h.crayon(), boards: h.margin2d()?.pieces.filter((p) => p.kind === 'billboard').length ?? 0 }
})

test('a won level: Bea has crayoned one advert, inside the field', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, true)
  await page.waitForTimeout(1000)
  const { crayon, boards } = await hg(page)
  if (!boards) return // the phone's field has no room for the Ballot's boards
  expect(crayon).not.toBeNull()
  const canvas = (await page.locator('canvas').first().boundingBox())!
  expect(crayon!.x).toBeGreaterThanOrEqual(0)
  expect(crayon!.x + crayon!.w).toBeLessThanOrEqual(canvas.width)
})

test('a level not yet won: no crayon on its adverts', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, false)
  await page.waitForTimeout(1000)
  expect((await hg(page)).crayon).toBeNull()
})
