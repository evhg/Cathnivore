import { expect, test, type Page } from '@playwright/test'

// Plan item 95: the round card as a threat poster (trait icons, a "Can't answer" stamp, the long read behind an
// (i)) and Cath's advice said in a bubble beside her on the field, before Go, clear of the lane's tiles.
type Box = { x: number; y: number; w: number; h: number }
type Say = { text: string; box: Box; cath: Box; lanes: Box[] }
type Hg = { game(): { phase: string; wave: number }; cathSay(): Say | null; gateQueue(): { leads: Box[]; plates: Box[] } | null; sendWave(g: unknown): unknown }

async function open(page: Page, level: number): Promise<void> {
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, move: true }
  const stars = Object.fromEntries(Array.from({ length: level - 1 }, (_, i) => [String(i + 1), 3]))
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars, tips, level] as const)
  await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: Hg }).hedgerow?.game(), null, { timeout: 60_000 })
}

const say = (page: Page) => page.evaluate(() => (window as unknown as { hedgerow: Hg }).hedgerow.cathSay())
const hit = (a: Box, b: Box) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1

for (const level of [3, 12, 21]) {
  test(`level ${level}: Cath says her advice beside her, off the gate queue, and goes quiet on Go`, async ({ page }) => {
    test.setTimeout(90_000)
    await open(page, level)
    // One voice at a time: a tip in her corner bubble holds the advice back, so let it go first.
    await page.evaluate(() => {
      const b = document.getElementById('bubble')
      if (b) b.hidden = true
    })
    await expect.poll(async () => (await say(page))?.text ?? '').not.toBe('')
    const s = (await say(page))!
    await expect(page.locator('#cath-say')).toBeVisible()
    await expect(page.locator('#cath-say')).toHaveText(s.text)
    const c = { x: s.cath.x + s.cath.w / 2, y: s.cath.y + s.cath.h / 2 }
    const dx = Math.max(s.box.x - c.x, 0, c.x - (s.box.x + s.box.w))
    const dy = Math.max(s.box.y - c.y, 0, c.y - (s.box.y + s.box.h))
    expect(Math.hypot(dx, dy), JSON.stringify(s.box)).toBeLessThanOrEqual(120)
    expect(hit(s.box, s.cath), 'bubble on her figure').toBe(false)
    // Never over the round's threat waiting at the gate (canvas px; the canvas fills the field).
    const q = await page.evaluate(() => (window as unknown as { hedgerow: Hg }).hedgerow.gateQueue())
    for (const b of [...(q?.leads ?? []), ...(q?.plates ?? [])]) expect(hit(s.box, b), `bubble ${JSON.stringify(s.box)} on the queue ${JSON.stringify(b)}`).toBe(false)
    await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: Hg }).hedgerow
      h.sendWave(h.game())
    })
    await expect(page.locator('#cath-say')).toBeHidden()
  })
}

// Level 23's first round flies, and the empty field can't answer the air.
test('level 23: the round ticket is a poster: few words, big trait icons, a stamp, and the rest behind (i)', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, 23)
  const ticket = page.locator('.round-ticket')
  await expect(ticket).toBeAttached()
  const icons = page.locator('.threat-traits .trait-icon')
  expect(await icons.count()).toBeGreaterThan(0)
  const wide = (page.viewportSize()?.width ?? 0) >= 900
  if (!wide) await page.locator('.drawer-handle').click()
  for (const b of await icons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))) expect(b).toBeGreaterThanOrEqual(28)
  await expect(page.locator('.trait-gap .trait-stamp')).toHaveText(/can't answer/i)
  await expect(page.locator('.trait-gap [data-prop="airborne"]')).toHaveCount(1)
  // Cath's line on the field names the gap the stamp shows.
  await page.evaluate(() => {
    const b = document.getElementById('bubble')
    if (b) b.hidden = true
  })
  if (wide) await expect(page.locator('#cath-say')).toContainText('air')
  if (wide) {
    // The words a sighted player reads on the card (the stub's screen-reader copy aside).
    const words = await ticket.evaluate((el) => {
      const c = el.cloneNode(true) as HTMLElement
      for (const x of c.querySelectorAll('.sr-only')) x.remove()
      return (c.textContent ?? '').replace(/([a-z])([A-Z×])/g, '$1 $2').split(/\s+/).filter((w) => /\w/.test(w)).length
    })
    expect(words).toBeLessThanOrEqual(25)
  }
  const notes = page.locator('#round-notes')
  await expect(notes).toBeHidden()
  await page.locator('.ticket-info').click()
  await expect(notes).toBeVisible()
  await expect(notes.locator('.field-warn')).toContainText("can't answer")
  await expect(notes.locator('.wave-advice')).toContainText('Cath')
  await page.locator('.ticket-info').click()
  await expect(notes).toBeHidden()
})
