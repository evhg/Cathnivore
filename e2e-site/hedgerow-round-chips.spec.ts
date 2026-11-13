import { expect, test } from '@playwright/test'

// Plan item 168: the coming rounds as an illustrated timeline. Five or more round chips, each with a stacked bar of
// its mix (segments summing to the bar), a flood round under a 'Flood' banner (12 px or more), a tap opening its
// vehicles, and on a phone the strip inside the round drawer, clear of the tray. Plan item 348: three readable cards
// (not five micro-chips): 'Round N', the lead at 32 px+ (28 on a phone), the count with its unit, the trait as a word
// 13 px or more.
type W = { hedgerow?: { game: () => { wave: number; level: { setPieces?: Array<{ kind: string; wave?: number }> } } | null } }

test('the rounds ahead are chips with their mix, the flood round bannered', async ({ page, isMobile }, info) => {
  await page.goto('/hedgerow/?2d&sandbox=1&level=34')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  await page.evaluate(() => {
    const g = (window as unknown as W).hedgerow!.game()!
    g.wave = g.level.setPieces!.find((p) => p.kind === 'flood')!.wave! - 2
  })
  const phone = isMobile || info.project.name.includes('phone')
  if (phone) await page.locator('.drawer-handle').click()
  const chips = page.locator('.round-strip .round-chip')
  await expect(chips).toHaveCount(3)
  for (const c of await chips.all()) {
    await expect(c).toBeVisible()
    await expect(c.locator('.round-no')).toHaveText(/^Round \d+$/i)
    await expect(c.locator('.round-count')).toHaveText(/^\d+vehicles?$/)
    const m = await c.evaluate((e) => ({
      // the vehicle inside its round plate's padding
      art: (() => {
        const i = e.querySelector('.chip-icon')!
        const cs = getComputedStyle(i)
        return i.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      })(),
      word: e.querySelector('.round-trait')!.textContent,
      sizes: ['.round-no', '.round-unit', '.round-trait'].map((q) => parseFloat(getComputedStyle(e.querySelector(q)!).fontSize)),
      cut: [...e.querySelectorAll('.round-no, .round-count, .round-trait')].some((x) => x.getBoundingClientRect().bottom > e.getBoundingClientRect().bottom + 0.5),
    }))
    expect(m.art).toBeGreaterThanOrEqual(phone ? 28 : 32)
    expect(m.word?.length).toBeGreaterThan(2)
    for (const z of m.sizes) expect(z).toBeGreaterThanOrEqual(13)
    expect(m.cut).toBe(false)
    const sum = await c.locator('.mix-bar').evaluate((bar) => {
      const w = bar.getBoundingClientRect().width
      return ([...bar.querySelectorAll('i')] as HTMLElement[]).reduce((a, i) => a + i.getBoundingClientRect().width, 0) / w
    })
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  }
  // Plan item 348: the soonest unanswered lock as a chip naming its answer, whole (not cut), 13 px or more; the row
  // names every lock with its answer for a reader.
  const lock = page.locator('.intel-locks .lock-chip')
  if (await lock.count()) {
    await expect(lock).toHaveText(/^\S+\s·\s\S/)
    const l = await lock.evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, fs: parseFloat(getComputedStyle(e).fontSize) }))
    expect(l.sw).toBeLessThanOrEqual(l.cw + 1)
    expect(l.fs).toBeGreaterThanOrEqual(13)
    await expect(page.locator('.intel-locks')).toHaveAttribute('aria-label', /^Still unanswered: .+ · .+/)
  }
  const flood = page.locator('.round-chip[data-twist="flood"]')
  await expect(flood).toHaveCount(1)
  const banner = flood.locator('.round-banner')
  await expect(banner).toHaveText(/flood/i)
  expect(parseFloat(await banner.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12)
  // Inside the viewport, and on a phone above the tray's foot (the strip sits in the drawer, not on the field).
  const vp = page.viewportSize()!
  const box = (await page.locator('.round-strip').boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  const panel = (await page.locator('.round-strip').evaluate((e) => e.closest('.panel')!.getBoundingClientRect().toJSON())) as DOMRect
  expect(box.y).toBeGreaterThanOrEqual(panel.y)
  // A tap opens its vehicles over the strip, inside the panel; a tap on them shuts them.
  await flood.locator('button').click()
  const detail = page.locator('#round-detail')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText(/floods/)
  expect(await detail.locator('li').count()).toBeGreaterThanOrEqual(1)
  const d = (await detail.boundingBox())!
  expect(d.y).toBeGreaterThanOrEqual(panel.y)
  expect(d.y + d.height).toBeLessThanOrEqual(Math.min(vp.height, panel.y + panel.height))
  await detail.click()
  await expect(detail).toBeHidden()
})
