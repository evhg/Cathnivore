import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 451: a card dragged over the land shows what it will do before you let go: the glowing hexes stay
// lit and the rest dim, the hex under the card shows a ghost piece and signed chips from the engine's preview,
// a drop off the glow springs the card back, and the keyboard can aim an armed card (arrows, then Enter).
// (SHOTS=1 saves mid-drag frames to e2e/screenshots.)

async function start(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '1')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
}

const pipsOn = (page: Page) => page.locator('.active-producer .pip.on').count()

async function pickUp(page: Page) {
  const card = page.locator(':is(.actions, .table-hand) .action-card-draggable').first()
  await card.scrollIntoViewIfNeeded()
  const from = (await card.boundingBox())!
  const x = from.x + from.width / 2
  const y = from.y + from.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 20, y - 40, { steps: 4 })
  await expect(page.locator('.drag-ghost')).toBeVisible()
  return { x, y }
}

test('over a glowing hex the card shows its ghost piece and what it will change', async ({ page }, testInfo) => {
  await start(page)
  const before = await pipsOn(page)
  await pickUp(page)
  const target = page.locator('.region-hex.glow').first()
  await expect(target).toBeVisible()
  const t = (await target.locator('polygon').first().boundingBox())!
  await page.mouse.move(t.x + t.width / 2 - 25, t.y + t.height / 2, { steps: 6 })
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 4 })
  const aim = page.locator('.map .aim-layer')
  await expect(aim).toHaveCount(1)
  const chips = await aim.locator('.aim-chip text').allTextContents()
  expect(chips.length).toBeGreaterThan(0)
  for (const c of chips) expect(c).toMatch(/^([+−]\d+ \w+|Liberated)$/)
  // The chips stay readable: 13 px on screen whatever the board's scale.
  const fs = await aim.locator('.aim-chip text').first().evaluate((el) => el.getBoundingClientRect().height)
  expect(fs).toBeGreaterThanOrEqual(11)
  await expect(page.locator('.drag-ghost')).toHaveAttribute('data-over', '')
  // The drag moves the card by transform only.
  const ghost = await page.locator('.drag-ghost').evaluate((el) => ({ t: getComputedStyle(el).transform, l: getComputedStyle(el).left }))
  expect(ghost.t).not.toBe('none')
  expect(ghost.l).toBe('0px')
  // The hexes it can't go to dim to at most 55% of a lit one.
  const dim = page.locator('.region-hex.dimmed').first()
  if ((await dim.count()) > 0) {
    const o = await dim.evaluate((el) => Number(getComputedStyle(el).opacity))
    expect(o).toBeLessThanOrEqual(0.55)
  }
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/card-drag-aim-${testInfo.project.name}.png` })
  await page.mouse.up()
  await expect(page.locator('.drag-ghost')).toHaveCount(0)
  await expect.poll(() => pipsOn(page)).toBe(before - 1)
})

test('a card dropped off the glow springs back and nothing is played', async ({ page }) => {
  await start(page)
  const before = await pipsOn(page)
  const { x, y } = await pickUp(page)
  // Off every hex: the top-left corner of the window.
  await page.mouse.move(6, 6, { steps: 6 })
  await expect(page.locator('.map .aim-layer')).toHaveCount(0)
  await page.mouse.up()
  const ghost = page.locator('.drag-ghost')
  await expect(ghost).toHaveAttribute('data-back', '')
  await expect(ghost).toHaveCount(0)
  expect(await pipsOn(page)).toBe(before)
  expect(x + y).toBeGreaterThan(0)
})

test('the keyboard aims an armed card: arrows cycle the glowing regions, Enter plays', async ({ page }) => {
  await start(page)
  const before = await pipsOn(page)
  // Arm a card that needs a region (its click opens targeting rather than playing at once).
  const cards = page.locator(':is(.actions, .table-hand) .action-card-draggable')
  const n = await cards.count()
  let armed = false
  for (let i = 0; i < n && !armed; i++) {
    const label = (await cards.nth(i).getAttribute('aria-label')) ?? (await cards.nth(i).textContent()) ?? ''
    if (!/…|Pick a region/.test(label)) continue
    await cards.nth(i).scrollIntoViewIfNeeded()
    await cards.nth(i).click()
    armed = (await page.locator('.action-raised').count()) > 0
  }
  test.skip(!armed, 'no multi-region card on this seed')
  await page.locator('body').focus()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible()
  const first = await page.locator('.map .aim-layer').getAttribute('data-aim')
  await page.keyboard.press('ArrowRight')
  const second = await page.locator('.map .aim-layer').getAttribute('data-aim')
  expect(second).not.toBe(first)
  await page.keyboard.press('Enter')
  await expect.poll(() => pipsOn(page)).toBe(before - 1)
})
