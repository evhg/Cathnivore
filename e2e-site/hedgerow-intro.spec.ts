import { expect, test, type Page } from '@playwright/test'

// Plan item 64: a new enemy arrives as a page of Cath's field guide. The field holds until the player taps on.
const URL = '/hedgerow/?2d&sandbox=1&intro=hold'
const KINDS = ['van', 'courier', 'hatchback', 'pickup', 'sprinter', 'lorry', 'quad', 'wrapped', 'steel', 'artic', 'transporter', 'skip', 'plantdozer', 'crane', 'execcar', 'borer', 'boss', 'truck', 'convoy', 'influencer', 'blimp', 'bulldozer', 'megadozer', 'phantom', 'clinic', 'tender', 'ship', 'lawyer', 'lobbyist', 'carrier', 'rival']

type Hook = { game(): { waveClock: number; wave: number; enemies: Array<{ kind: string }> }; sendWave(g: unknown, early: boolean): void; refresh(): void }

async function open(page: Page, level: number): Promise<void> {
  await page.goto(URL)
  await page.evaluate(
    ([l, kinds]) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < (l as number); i++) stars[String(i)] = 3
      // Everything met but the drone, and every tip read, so the drone's page is the one that comes.
      const seen = Object.fromEntries((kinds as string[]).map((k) => [k, true]))
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen, tips: { all: true } }))
    },
    [level, KINDS] as const,
  )
  await page.goto(`${URL}&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 30000 })
}

const clock = (page: Page) => page.evaluate(() => (window as unknown as { hedgerow: Hook }).hedgerow.game().waveClock)

test('plan item 64: the first drone round holds the field on a field-guide page until it is dismissed', async ({ page }) => {
  await open(page, 18)
  // Level 18's drones come in round 3: jump the field to it and send it.
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: Hook }).hedgerow
    hg.game().wave = 2
    hg.sendWave(hg.game(), false)
    hg.refresh()
  })
  const intro = page.locator('#intro.intro-page')
  await expect(intro).toBeVisible({ timeout: 30000 })
  await expect(intro).toHaveAttribute('data-kind', 'drone')
  await expect(intro.locator('h2')).toHaveText('Delivery drone')
  await expect(intro.locator('.intro-traits')).toContainText('Flies')
  // The whole description, never an ellipsis, and the towers that reach it lit.
  const desc = (await intro.locator('.intro-desc').textContent()) ?? ''
  expect(desc.length).toBeGreaterThan(20)
  expect(desc).not.toContain('…')
  await expect(intro.locator('.intro-desc')).toBeInViewport({ ratio: 1 })
  expect(await intro.locator('.intro-reach li.lit').count()).toBeGreaterThanOrEqual(1)
  await expect(intro.locator('.intro-go')).toBeInViewport({ ratio: 1 })
  // Paused: the round's clock doesn't move while the page is up.
  const a = await clock(page)
  await page.waitForTimeout(1200)
  expect(await clock(page)).toBe(a)
  await intro.locator('.intro-go').click()
  await expect(page.locator('#intro')).toBeHidden()
  await page.waitForTimeout(1200)
  expect(await clock(page)).toBeGreaterThan(a)
  // Seen: it never comes again, even on a fresh load.
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('hedgerow:v1') ?? '{}').seen?.drone)
  expect(seen).toBe(true)
})

test('plan item 64: a cleared round pins its rosette clear of every plot, and its coins fly to the Marks chip', async ({ page }) => {
  await open(page, 12)
  for (const clean of [true, false]) {
    await page.evaluate((c) => (window as unknown as { hedgerow: { rosette(r: number, m: number, c: boolean): void } }).hedgerow.rosette(4, 63, c), clean)
    const rosette = page.locator('.round-rosette')
    await expect(rosette).toBeVisible()
    await expect(rosette).toHaveClass(clean ? /clean/ : /^(?!.*clean)/)
    await expect(rosette).toContainText(clean ? 'Clean sweep' : 'Round 4')
    await expect(rosette).toContainText('+63')
    await page.waitForTimeout(500)
    const box = (await rosette.boundingBox())!
    const stage = (await page.locator('#stage').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(stage.x)
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1)
    const plots = await page.evaluate(() => (window as unknown as { hedgerow: { plotBoxes(): Array<{ x: number; y: number; w: number; h: number }> } }).hedgerow.plotBoxes())
    expect(plots.length).toBeGreaterThan(5)
    // The art's box is 120x144 with transparent corners; the whole box still covers no plot (1 px slack for rounding).
    const hit = plots.filter((p) => box.x + 1 < p.x + p.w && p.x + 1 < box.x + box.width && box.y + 1 < p.y + p.h && p.y + 1 < box.y + box.height)
    expect(hit).toEqual([])
    await expect(page.locator('.flying-coin').first()).toBeAttached()
  }
})
