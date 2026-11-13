import { expect, test, type Page } from '@playwright/test'

// Plan item 19: a living field. One voice at a time, and the field is the desktop screen.
const URL = '/hedgerow/?2d&sandbox=1'

async function open(page: Page, level: number, tips: Record<string, boolean>): Promise<void> {
  await page.goto(URL)
  await page.evaluate(
    ([l, t]) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < (l as number); i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: t }))
    },
    [level, tips] as const,
  )
  await page.goto(`${URL}&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 30000 })
}

const voices = (page: Page) =>
  page.evaluate(() => ['#bubble', '#intro'].filter((s) => {
    const el = document.querySelector<HTMLElement>(s)
    return !!el && !el.hidden && el.getClientRects().length > 0
  }).length)

test('plan item 19: Cath\'s bubble and the "new on the lane" card never show together, and the side panel has no voice', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, 12, {})
  // A fresh tip list: Cath speaks as the field opens.
  await expect(page.locator('#bubble')).toBeVisible({ timeout: 8000 })
  // Nothing has been seen yet, so the first round brings a "new on the lane" card while she is talking.
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: { game(): unknown; sendWave(g: unknown, early: boolean): void; refresh(): void } }).hedgerow
    hg.sendWave(hg.game(), true)
    hg.refresh()
  })
  let most = 0
  let introSeen = false
  for (let i = 0; i < 40; i++) {
    most = Math.max(most, await voices(page))
    introSeen ||= await page.locator('#intro').isVisible()
    await page.waitForTimeout(150)
  }
  expect(introSeen).toBe(true)
  expect(most).toBeLessThanOrEqual(1)
  await expect(page.locator('#panel .cath-tip')).toHaveCount(0)
})

test('plan item 19: at 1440x900 the field takes at least 70% of the width, and the side panel is a wave card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, 12, { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true })
  const w = await page.locator('#canvas').evaluate((c) => c.getBoundingClientRect().width / innerWidth)
  expect(w).toBeGreaterThanOrEqual(0.7)
  await expect(page.locator('#panel .round-ticket')).toBeVisible()
  await expect(page.locator('#panel .intel-towers')).toHaveCount(0)
})

test('plan item 69: on an upright phone Cath\'s note is a slim slip clear of the round tab', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the upright phone layout')
  await open(page, 12, {})
  const bubble = page.locator('#bubble')
  await expect(bubble).toBeVisible()
  const b = (await bubble.boundingBox())!
  expect(b.height).toBeLessThanOrEqual(84)
  const tab = await page.evaluate(() => {
    const t = [...document.querySelectorAll<HTMLElement>('body *')].find((e) => /^NEXT: ROUND/i.test(e.textContent?.trim() ?? '') && e.children.length < 3 && e.getClientRects().length)
    return t ? t.getBoundingClientRect().top : null
  })
  if (tab !== null) expect(b.y + b.height).toBeLessThanOrEqual(tab + 1)
})

test('plan item 345: the plots\' outlines show only while building, every free plot stitched 2 px+', async ({ page }) => {
  await open(page, 21, { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true })
  const hg = () => page.evaluate(() => (window as unknown as { hedgerow: { outlines(): Array<{ col: number; row: number; width: number }> } }).hedgerow.outlines())
  // Nothing picked: no plot outlines, the field reads as fields.
  await page.waitForTimeout(500)
  expect(await hg()).toHaveLength(0)
  const boxes = await page.evaluate(() => (window as unknown as { hedgerow: { plotBoxes(): Array<{ x: number; y: number; w: number; h: number }> } }).hedgerow.plotBoxes())
  const { towers, barns } = await page.evaluate(() => {
    const g = (window as unknown as { hedgerow: { game(): { towers: unknown[]; level: { barns?: Array<[number, number]> } } } }).hedgerow.game()
    return { towers: g.towers.length, barns: g.level.barns ?? [] }
  })
  const mid = boxes[Math.floor(boxes.length / 2)]!
  await page.mouse.click(mid.x + mid.w / 2, mid.y + mid.h / 2)
  await expect.poll(async () => (await hg()).length).toBeGreaterThan(0)
  const shown = await hg()
  // Every other plot a tower could go on is outlined (the picked one has its own ring); a barn's never is.
  expect(shown.length).toBeLessThanOrEqual(boxes.length - towers - 1)
  expect(shown.length).toBeGreaterThanOrEqual((boxes.length - towers - 1 - barns.length) * 0.8)
  for (const o of shown) expect(o.width).toBeGreaterThanOrEqual(2)
  for (const [c, r] of barns) expect(shown.some((o) => o.col === c && o.row === r)).toBe(false)
})
