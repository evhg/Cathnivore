import { test, expect, type Page } from '@playwright/test'
import { APPS } from '../portfolio/src/apps'

// Plan item 491: today in the studio. The hero's numbers row becomes a 24-hour track of the build sessions from the
// build's studio.json (a fixture here: the real one depends on the clone's history), a notch per session, each opening
// a card with its subjects and its game's frame; the numbers stay as captions, and stay a row when the JSON is missing.
const NOW = Math.floor(Date.now() / 1000)
const FIXTURE = {
  generated: NOW,
  sessions: [
    { lane: 'A', start: NOW - 20 * 3600, end: NOW - 19.6 * 3600, game: 'cathnivore', subjects: ['Cathnivore: the producers talk back at the table'] },
    { lane: 'B', start: NOW - 9 * 3600, end: NOW - 8.5 * 3600, game: 'runnel', subjects: ['Runnel: a connection glints once', 'Runnel: dry grooves'] },
    { lane: 'A', start: NOW - 2 * 3600, end: NOW - 1.7 * 3600, game: 'hedgerow', subjects: ['Hedgerow: the day passes over the field', 'Hedgerow 3D: hens', 'Hedgerow: a fix', 'Hedgerow: one more'] },
  ],
}

async function open(page: Page, body: unknown = FIXTURE) {
  await page.route('**/studio.json', (route) =>
    body === null ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  )
  await page.goto('/')
  await page.waitForTimeout(1500)
}

test('the track has a notch per session, spans the page at D and never scrolls the phone sideways', async ({ page }) => {
  await open(page)
  const track = page.locator('[data-studio-track]')
  await expect(track.locator('.notch')).toHaveCount(3)
  await expect(track.locator('.studio-row[data-lane="A"] .notch')).toHaveCount(2)
  // the numbers are captions under it
  await expect(page.locator('.studio .stats [data-count]')).toHaveCount(4)
  const box = (await track.boundingBox())!
  const w = page.viewportSize()!.width
  if (w >= 1440) {
    expect(box.x).toBeGreaterThanOrEqual(99)
    expect(box.x + box.width).toBeLessThanOrEqual(1341)
    expect(box.width).toBeGreaterThanOrEqual(1200)
    // Plan item 626: the numbers under the band clear the fold at 1440x900
    const st = (await page.locator('.studio .stats').boundingBox())!
    if (page.viewportSize()!.height <= 900) expect(st.y + st.height).toBeLessThanOrEqual(890)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  // notches stand in time order along the track
  const xs = await track.locator('.notch').evaluateAll((ns) => ns.map((n) => [Number((n as HTMLElement).dataset.index), n.getBoundingClientRect().left]))
  const byIndex = xs.sort((a, b) => a[0]! - b[0]!).map((p) => p[1]!)
  expect(byIndex).toEqual([...byIndex].sort((a, b) => a - b))
})

test("a notch opens its session's card with the game's frame from apps.ts", async ({ page }) => {
  await open(page)
  const games = APPS.find((a) => a.id === 'games')!
  const srcs = games.visual.kind === 'image' ? games.visual.src : []
  const notch = page.locator('.notch[data-game="hedgerow"]')
  if ((page.viewportSize()?.width ?? 0) >= 1100) await notch.hover()
  else await notch.click()
  const card = page.locator('.studio-card.is-active')
  await expect(card).toHaveAttribute('data-game', 'hedgerow')
  await expect(card).toBeVisible()
  await expect(card.locator('.studio-card-game')).toHaveText('Hedgerow')
  await expect(card.locator('li')).toHaveCount(4) // three subjects and 'and 1 more'
  const src = (await card.locator('img').getAttribute('src'))!
  expect(srcs).toContain(src.replace('-640.webp', '.webp'))
  await expect(card).toBeInViewport({ ratio: 0.6 })
  // no author, email or link reaches the page from the log
  await expect(page.locator('.studio')).not.toContainText('@')
})

test('the cards are reachable from the keyboard', async ({ page }) => {
  await open(page)
  await page.locator('.notch').first().focus()
  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.index)
  expect(focused).toBeDefined()
  await expect(page.locator('.notch[aria-pressed="true"]')).toHaveAttribute('data-index', focused!)
  await expect(page.locator(`#studio-card-${focused}`)).toHaveClass(/is-active/)
  // Plan item 626: a notch names its lane, time, game and change, and wears its game's colour.
  await expect(page.locator('.notch[data-game="hedgerow"]')).toHaveAttribute('aria-label', /^Lane A, .+, Hedgerow: the day passes over the field, and 3 more changes$/)
  const colors = await page.locator('.notch').evaluateAll((ns) => ns.map((n) => getComputedStyle(n).backgroundColor))
  expect(new Set(colors).size).toBe(3)
})

test('on a phone the cards are a swiped row that opens on the newest session', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1100, 'the phone row')
  await open(page)
  await page.locator('.studio').scrollIntoViewIfNeeded()
  await expect(page.locator('#studio-card-2')).toHaveClass(/is-active/)
  await expect(page.locator('#studio-card-2')).toBeInViewport({ ratio: 0.9 })
  await page.locator('.notch[data-index="0"]').click()
  await expect(page.locator('#studio-card-0')).toHaveClass(/is-active/)
  await expect(page.locator('#studio-card-0')).toBeInViewport({ ratio: 0.9 })
})

test('without a studio log the numbers row stays as it was', async ({ page }) => {
  await open(page, null)
  await expect(page.locator('#studio')).toBeHidden()
  await expect(page.locator('.hero > .stats [data-count]')).toHaveCount(4)
  await expect(page.locator('.hero')).not.toHaveClass(/has-studio/)
})

// Plan item 689: beside the track the sessions figure is the track's own count, not a fixed '48 a day'.
test('the sessions figure matches the track', async ({ page }) => {
  await page.goto('/')
  const studio = page.locator('#studio')
  test.skip(!(await studio.isVisible().catch(() => false)) && (await page.locator('#studio[hidden]').count()) > 0, 'no studio log in this build')
  const sessions = await page.evaluate(async () => {
    const r = await fetch('/studio.json')
    const j = (await r.json()) as { sessions: Array<{ subjects: string[] }> }
    return j.sessions.filter((s) => s.subjects.length > 0).length
  })
  const stat = page.locator('[data-stat="sessions"]')
  await expect(stat.locator('dt')).toHaveText('Build sessions, last 24 hours')
  await expect(stat.locator('[data-count]')).toHaveAttribute('data-count', String(sessions))
  await expect(stat.locator('[data-count]')).toHaveText(String(sessions), { timeout: 5000 })
})
