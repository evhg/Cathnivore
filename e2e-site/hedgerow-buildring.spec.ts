import { expect, test, type Page } from '@playwright/test'

// Plan item 156: tap an empty plot and its seed packets ring it, each 44 px or larger, inside the screen and off the
// plot; one you can't afford says so; pressing one previews its range ring (the tower's own range); it plants there.
type Box = { x: number; y: number; w: number; h: number }
type G = { marks: number; towers: { col: number; row: number }[]; level: { towers: string[] } }
type HG = {
  game(): G | null
  plotBoxes(): Box[]
  ring(): { range: number; px: number; cell: number } | null
  towerRange(kind: string): number
}
const hg = (page: Page) => page.evaluate.bind(page)
const meet = (a: Box, b: Box) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5

async function open(page: Page) {
  await page.goto('/hedgerow/?2d&sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30_000 })
  await page.waitForTimeout(600)
}

/** Plots whose centre is open canvas (no panel or chip over it): the top-left, bottom-right and middle ones. */
async function plots(page: Page): Promise<Box[]> {
  return hg(page)(() => {
    const all = (window as unknown as { hedgerow: HG }).hedgerow.plotBoxes().filter((b) => {
      const el = document.elementFromPoint(b.x + b.w / 2, b.y + b.h / 2)
      return el?.id === 'canvas'
    })
    const by = (f: (b: Box) => number) => all.reduce((m, b) => (f(b) < f(m) ? b : m))
    const cx = innerWidth / 2, cy = innerHeight / 2
    return [by((b) => b.x + b.y), by((b) => -(b.x + b.y)), by((b) => Math.hypot(b.x - cx, b.y - cy)), by((b) => b.x - b.y), by((b) => b.y - b.x)]
  })
}

async function tap(page: Page, touch: boolean, x: number, y: number) {
  if (touch) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}

test('an empty plot opens a ring of packets round it, inside the screen and off the plot', async ({ page, hasTouch }) => {
  await open(page)
  const kinds = await hg(page)(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.level.towers.length)
  const vw = page.viewportSize()!
  for (const plot of await plots(page)) {
    await page.keyboard.press('Escape')
    await tap(page, hasTouch, plot.x + plot.w / 2, plot.y + plot.h / 2)
    const ring = page.locator('[data-build-ring]')
    await expect(ring).toBeVisible()
    await expect(ring.locator('.ring-packet')).toHaveCount(kinds)
    await page.waitForTimeout(300)
    const boxes = await ring.locator('.ring-packet').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }))
    for (const [i, b] of boxes.entries()) {
      expect(b.w).toBeGreaterThanOrEqual(44)
      expect(b.h).toBeGreaterThanOrEqual(44)
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w).toBeLessThanOrEqual(vw.width)
      expect(b.y + b.h).toBeLessThanOrEqual(vw.height)
      expect(meet(b, plot), `packet ${i} over the plot at ${JSON.stringify(plot)}`).toBe(false)
      for (const o of boxes.slice(i + 1)) expect(meet(b, o)).toBe(false)
    }
  }
})

test('pressing a packet previews its range, and it plants on the plot', async ({ page, hasTouch }) => {
  await open(page)
  const plot = (await plots(page))[2]!
  await tap(page, hasTouch, plot.x + plot.w / 2, plot.y + plot.h / 2)
  const packet = page.locator('.ring-packet[data-kind="scarecrow"]')
  await expect(packet).toBeVisible()
  await page.waitForTimeout(300)
  if (hasTouch) await packet.tap()
  else await packet.hover()
  await expect(packet.locator('.ring-name')).toBeVisible()
  await expect.poll(() => hg(page)(() => (window as unknown as { hedgerow: HG }).hedgerow.ring()?.range ?? 0)).toBeGreaterThan(0)
  const m = await hg(page)(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    return { ring: h.ring()!, range: h.towerRange('scarecrow') }
  })
  expect(m.ring.range).toBeCloseTo(m.range, 3)
  expect(m.ring.px).toBeCloseTo(m.range * m.ring.cell, 3)
  const before = await hg(page)(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.towers.length)
  if (hasTouch) await packet.tap()
  else await packet.click()
  await expect.poll(() => hg(page)(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.towers.length)).toBe(before + 1)
  await expect(page.locator('[data-build-ring]')).toBeHidden()
})

test('a packet you cannot afford says so', async ({ page, hasTouch }) => {
  await open(page)
  await hg(page)(() => { (window as unknown as { hedgerow: HG }).hedgerow.game()!.marks = 0 })
  const plot = (await plots(page))[2]!
  await tap(page, hasTouch, plot.x + plot.w / 2, plot.y + plot.h / 2)
  const packets = page.locator('.ring-packet')
  await expect(packets.first()).toBeVisible()
  await expect.poll(() => packets.evaluateAll((els) => els.every((e) => e.getAttribute('data-affordable') === 'false'))).toBe(true)
  const before = await hg(page)(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.towers.length)
  await packets.first().click()
  await packets.first().click()
  expect(await hg(page)(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.towers.length)).toBe(before)
})
