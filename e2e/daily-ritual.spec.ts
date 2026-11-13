import { test, expect, type Page } from '@playwright/test'

// Plan item 133: the Daily Market as a ritual on the title table. From a fixture save: the last Daily's receipt
// pinned to the table (120 px or more wide at D, 90 at P), inside the viewport and meeting no menu button; a
// 3-day streak hangs 3 pennants (D); tomorrow's card counts down (D); a broken streak changes Cath's face.
type Box = { x: number; y: number; width: number; height: number }
const meet = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function seed(page: Page, kind: 'none' | 'broken' | number) {
  await page.goto('/')
  await page.evaluate((k) => {
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
    const results: Record<string, unknown> = {}
    if (k === 'broken') {
      results[day(2)] = { won: true, rounds: 9, regions: 5, trust: 7 }
      results[day(1)] = { won: false, rounds: 12, regions: 3, trust: 2 }
    } else if (typeof k === 'number') for (let i = 1; i <= k; i++) results[day(i)] = { won: true, rounds: 9, regions: 5, trust: 7 }
    localStorage.setItem('cathnivore:daily', JSON.stringify({ results }))
  }, kind)
  await page.reload()
  await expect(page.locator('.title-daily')).toBeVisible()
  // the title's entrance animations
  await page.waitForTimeout(1600)
}

const visibleRitual = (page: Page) => page.locator('.daily-ritual:visible')

test("yesterday's receipt is pinned to the table, clear of the menu", async ({ page }) => {
  await seed(page, 3)
  const ritual = visibleRitual(page)
  await expect(ritual).toHaveCount(1)
  const receipt = ritual.locator('.ritual-receipt')
  await expect(receipt).toContainText('Yesterday')
  await expect(receipt.locator('.ritual-stamp')).toHaveText(/sold/i)
  const vp = page.viewportSize()!
  const b = (await receipt.boundingBox())!
  expect(b.width).toBeGreaterThanOrEqual(vp.width >= 1024 ? 120 : 90)
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.y).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width)
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height)
  for (const btn of await page.locator('.title-menu button').all()) {
    const m = await btn.boundingBox()
    if (m) expect(meet(b, m), `receipt meets ${await btn.textContent()}`).toBe(false)
  }
  // the footer's links stay readable beside it
  for (const a of await page.locator('.title-footer a').all()) {
    const m = await a.boundingBox()
    if (m) expect(meet(b, m)).toBe(false)
  }
  // plan item 139: on a phone it lies on the table's front under Cath, not across her torso
  if (vp.width < 761) {
    const art = (await page.locator('.title-art').boundingBox())!
    expect(b.y).toBeGreaterThanOrEqual(art.y + art.height - 30)
  }
  // no scroll was added
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true)
  // one pennant a day: the table's string at D, a row on the receipt on a phone
  await expect(ritual.locator('[data-pennant]')).toHaveCount(3)
  if (vp.width >= 1024) {
    await expect(ritual.locator('.ritual-card-in')).toHaveText(/^in (\d+h )?\d+m$/)
    const card = (await ritual.locator('.ritual-card').boundingBox())!
    expect(card.x + card.width).toBeLessThanOrEqual(vp.width)
    expect(meet(b, card)).toBe(false)
  }
})

test('a broken streak changes her face and her line; a kept one names the days', async ({ page }) => {
  await seed(page, 3)
  const cath = page.locator('.title-cath')
  await expect(cath).toHaveAttribute('data-expression', 'delighted')
  await expect(page.locator('.title-cath-line')).toContainText('3 days running')
  await seed(page, 'broken')
  await expect(cath).toHaveAttribute('data-expression', 'worried')
  await expect(visibleRitual(page).locator('.ritual-stamp')).toHaveText(/held/i)
  if (page.viewportSize()!.width >= 1024) await expect(visibleRitual(page).locator('.ritual-pennant')).toHaveCount(0)
})

test('a player who never played the Daily keeps the campaign line and sees a blank receipt', async ({ page }) => {
  await seed(page, 'none')
  await expect(page.locator('.title-cath-line')).toContainText('Brindle Hills')
  await expect(visibleRitual(page).locator('.ritual-receipt.is-blank')).toBeVisible()
})

test("tomorrow's card flips face up as the new Daily opens at 00:00 UTC", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, 'the card is on the desktop table')
  await page.clock.install({ time: new Date('2026-11-05T23:59:00Z') })
  await seed(page, 3)
  const card = visibleRitual(page).locator('.ritual-card')
  await expect(card.locator('.ritual-card-in')).toHaveText('in 1m')
  await expect(card).not.toHaveAttribute('data-flipped', /.*/)
  const next = await card.locator('.ritual-card-down .ritual-card-no').textContent()
  await page.clock.fastForward('02:00')
  await expect(card).toHaveAttribute('data-flipped', 'true')
  await expect(card.locator('.ritual-card-up .ritual-card-no')).toHaveText(next!)
  await expect(card.locator('.ritual-card-event')).not.toBeEmpty()
})

// Plan item 342: at D the Daily is one chalk board on the counter: one Daily element in the band, its words 15 px or
// more at 4.5:1 on the slate, every line whole, today's number the menu's own, and the board off the menu, Cath, the
// game board's frame and the footer's links at 1024, 1280 and 1440.
test('at D the Daily is one chalk board with the menu’s number, clear of the stall', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, 'the desktop counter')
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]] as const) {
    await page.setViewportSize({ width, height })
    await seed(page, 3)
    const board = page.locator('.ritual-board')
    // every chalk line whole (none cut to an ellipsis)
    const cut = await board.evaluate((b) => [...b.querySelectorAll<HTMLElement>('.ritual-streak, .ritual-receipt-when, .ritual-card-in, .ritual-kicker')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent))
    expect(cut, `${width}`).toEqual([])
    await expect(board).toHaveCount(1)
    await expect(page.locator('.daily-ritual:visible')).toHaveCount(1)
    // Its one focal number is today's, read from the menu's Daily button.
    await expect(board.locator('.ritual-today-no')).toHaveText((await page.locator('.title-daily-no').textContent())!)
    const m = await page.evaluate(() => {
      const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      // rgb(246, 235, 216) or color(srgb 0.96 0.92 0.85 / 0.88): its luminance and its alpha
      const lum = (c: string) => {
        const n = c.match(/[\d.]+/g)!.map(Number)
        const k = c.startsWith('color(') ? 255 : 1
        return { l: 0.2126 * lin(n[0]! * k) + 0.7152 * lin(n[1]! * k) + 0.0722 * lin(n[2]! * k), a: n[3] ?? 1 }
      }
      const b = document.querySelector('.ritual-board')!
      // Its words: the leaf text, but not the card's face-down back (the face-up side waits for midnight).
      const words = [...b.querySelectorAll<HTMLElement>('*')].filter((e) => e.childElementCount === 0 && e.textContent!.trim() && e.getClientRects().length && !e.closest('.ritual-card-up'))
      return {
        small: words.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 15).map((e) => e.textContent),
        lums: words.map((e) => lum(getComputedStyle(e).color)),
        box: b.getBoundingClientRect().toJSON() as Box,
      }
    })
    expect(m.small, `${width}`).toEqual([])
    const box = m.box
    for (const sel of ['.title-menu', '.title-cath svg', '.title-board', '.title-footer a']) {
      for (const el of await page.locator(sel).all()) {
        const o = await el.boundingBox()
        if (o) expect(meet(box, o), `${sel} at ${width}`).toBe(false)
      }
    }
    // The chalk reads at 4.5:1 or more on the slate: sampled from a shot of the board with its words hidden.
    await page.addStyleTag({ content: '.ritual-board * { visibility: hidden !important; }' })
    const png = (await page.screenshot({ clip: { x: box.x + 8, y: box.y + 8, width: box.width - 16, height: box.height - 16 } })).toString('base64')
    await page.addStyleTag({ content: '.ritual-board * { visibility: visible !important; }' })
    const slate = await page.evaluate(async (png) => {
      const img = new Image()
      img.src = `data:image/png;base64,${png}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      const ls: number[] = []
      for (let i = 0; i < d.length; i += 4) ls.push(0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!))
      ls.sort((a, b) => a - b)
      return ls[Math.floor(ls.length * 0.95)]!
    }, png)
    // a translucent chalk line blends toward the slate
    for (const { l, a } of m.lums) expect((a * l + (1 - a) * slate + 0.05) / (slate + 0.05), `${width}`).toBeGreaterThanOrEqual(4.5)
  }
})
