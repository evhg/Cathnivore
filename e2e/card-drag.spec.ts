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

/** Mean relative luminance of the faces of the hexes matching `sel` (the middle of each tile, clear of its frame). */
async function faceLuminance(page: Page, sel: string): Promise<number> {
  const vals: number[] = []
  for (const g of await page.locator(`.map-wrap ${sel}`).all()) {
    const b = (await g.locator('polygon').first().boundingBox())!
    const png = await page.screenshot({ clip: { x: b.x + b.width * 0.3, y: b.y + b.height * 0.55, width: b.width * 0.4, height: b.height * 0.3 } })
    vals.push(
      await page.evaluate(async (b64) => {
        const img = new Image()
        img.src = `data:image/png;base64,${b64}`
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const x = c.getContext('2d')!
        x.drawImage(img, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data
        const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        let s = 0
        for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!)
        return s / (d.length / 4)
      }, png.toString('base64')),
    )
  }
  return vals.reduce((a, v) => a + v, 0) / vals.length
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
  // The hexes it can go to light the moment it's pressed, before it moves.
  await expect(page.locator('.region-hex.glow').first()).toBeVisible({ timeout: 1000 })
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
  // The hexes it can't go to dim to at most 55% of a lit one's luminance (the tiles' faces, measured on screen).
  if ((await page.locator('.region-hex.dimmed').count()) > 0) {
    const lit = await faceLuminance(page, '.region-hex.glow')
    const dim = await faceLuminance(page, '.region-hex.dimmed')
    expect(dim, `dimmed ${dim.toFixed(3)} vs lit ${lit.toFixed(3)}`).toBeLessThanOrEqual(lit * 0.55)
  }
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/card-drag-aim-${testInfo.project.name}.png` })
  const aimed = await aim.getAttribute('data-aim')
  await page.mouse.up()
  if (process.env.SHOTS) {
    await page.waitForTimeout(110)
    await page.screenshot({ path: `e2e/screenshots/card-drag-land-${testInfo.project.name}.png` })
  }
  await expect(page.locator('.drag-ghost')).toHaveCount(0)
  // It lands with a stamp on the hex it was dropped on.
  await expect(page.locator('.map .play-stamp')).toHaveAttribute('data-stamp', aimed!)
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

test("a Supply card over its hex marks Hollowell's stack that will lose a piece", async ({ page }) => {
  await start(page)
  const card = page.locator(':is(.actions, .table-hand) .action-card-draggable', { hasText: /Supply/ }).first()
  test.skip((await card.count()) === 0, 'no Supply card on this seed')
  await card.scrollIntoViewIfNeeded()
  const from = (await card.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 20, from.y - 30, { steps: 4 })
  const target = page.locator('.region-hex.glow').first()
  const t = (await target.locator('polygon').first().boundingBox())!
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
  await expect(page.locator('.map .aim-chip text', { hasText: /−1 Outlet/ })).toHaveCount(1)
  await expect(page.locator('.map .piece-slot[data-going][data-piece="o"]')).toHaveCount(1)
  await page.mouse.move(6, 6, { steps: 4 })
  await expect(page.locator('.map .piece-slot[data-going]')).toHaveCount(0)
  await page.mouse.up()
})

test('with a card armed, the mouse over a glowing hex shows what it will do there before the click', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'mouse hover')
  await start(page)
  const cards = page.locator(':is(.actions, .table-hand) .action-card-draggable')
  const n = await cards.count()
  let armed = false
  for (let i = 0; i < n && !armed; i++) {
    const label = (await cards.nth(i).getAttribute('aria-label')) ?? (await cards.nth(i).textContent()) ?? ''
    if (!/…|Pick a region/.test(label)) continue
    await cards.nth(i).click()
    armed = (await page.locator('.action-raised').count()) > 0
  }
  test.skip(!armed, 'no multi-region card on this seed')
  const target = page.locator('.region-hex.glow').first()
  const id = (await target.getAttribute('data-tutorial'))!.replace(/^region-/, '')
  const t = (await target.locator('polygon').first().boundingBox())!
  await page.mouse.move(t.x + t.width / 2, t.y + t.height * 0.7, { steps: 4 })
  await expect(page.locator('.map .aim-layer')).toHaveAttribute('data-aim', id)
  await page.mouse.move(4, 4)
  await expect(page.locator('.map .aim-layer')).toHaveCount(0)
})
