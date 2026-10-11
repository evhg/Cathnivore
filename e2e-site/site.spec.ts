import { expect, test, type Page } from '@playwright/test'
import { LEVELS } from '../games/hedgerow/src/levels'
import { NO_PERKS } from '../games/hedgerow/src/engine'
import { Recorder, encodeReplay, startGame } from '../games/hedgerow/src/replay'
import AxeBuilder from '@axe-core/playwright'
import { dailyPuzzle, tapsToSolve, utcDateString } from '../games/runnel/src/engine'

async function assertNoSeriousIssues(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

async function noSideways(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('landing page', () => {
  test('shows the title and both games, with no errors or sideways scroll', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Cathnivore' })).toBeVisible()
    await expect(page.locator('a[href="/cathnivore/"]')).toBeVisible()
    await expect(page.locator('a[href="/runnel/"]')).toBeVisible()
    await noSideways(page)
    expect(errors).toEqual([])
  })

  test('still works with reduced motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    const errors = trackErrors(page)
    await page.goto('http://localhost:4175/')
    await expect(page.locator('a[href="/runnel/"]')).toBeVisible()
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('the Cathnivore card opens the game', async ({ page }) => {
    await page.goto('/')
    await page.locator('a[href="/cathnivore/"]').click()
    await expect(page).toHaveURL(/\/cathnivore\/$/)
    await expect(page.getByText('Quick Game')).toBeVisible()
  })

  test('the Runnel card opens the puzzle', async ({ page }) => {
    await page.goto('/')
    await page.locator('a[href="/runnel/"]').click()
    await expect(page).toHaveURL(/\/runnel\/$/)
    await expect(page.getByRole('heading', { name: 'Runnel' })).toBeVisible()
  })

  test('the Hedgerow card opens the game', async ({ page }) => {
    await page.goto('/')
    await page.locator('a[href="/hedgerow/"]').click()
    await expect(page).toHaveURL(/\/hedgerow\/$/)
    await expect(page.getByRole('heading', { name: 'Hedgerow' })).toBeVisible()
  })

  test('the root service worker is the self-removing replacement', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.ok()).toBe(true)
    expect(await res.text()).toContain('registration.unregister()')
  })

  test('shared root pages are still served', async ({ request }) => {
    for (const path of ['/privacy/', '/support/', '/version.json', '/fonts/fraunces-latin-700-normal.woff2']) {
      expect((await request.get(path)).ok(), path).toBe(true)
    }
  })

  test('has no serious or critical accessibility issues', async ({ browser }) => {
    // The title/cards fade in via a CSS entrance animation (`.reveal`, styles.css) that starts several
    // hundred ms after load and runs for ~1.1s per card. Scanning mid-animation catches a transient,
    // partial-opacity frame whose blended colours can read as low contrast even though the steady state
    // (and the reduced-motion state real users with that preference see, per styles.css's
    // `prefers-reduced-motion` block) is fine — reducedMotion here scans the actual persistent UI instead
    // of an animation frame, the same context the "still works with reduced motion" test above already uses.
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Cathnivore' })).toBeVisible()
    await assertNoSeriousIssues(page)
    await ctx.close()
  })
})

test.describe('Runnel', () => {
  test('first visit shows how to play, then a tap turns a tile', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/runnel/')
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('#hud-taps')).toHaveText('0')
    await page.locator('.tiles > g.cell:not(.stone)').first().click()
    await expect(page.locator('#hud-taps')).toHaveText('1')
    await noSideways(page)
    expect(errors).toEqual([])
  })

  test('solving the daily shows the result, and it survives a reload', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/runnel/?nohelp')
    const puzzle = dailyPuzzle(utcDateString(new Date()))
    const cells = page.locator('.tiles > g.cell')
    for (let i = 0; i < puzzle.cells.length; i++) {
      const n = tapsToSolve(puzzle.cells[i]!)
      for (let k = 0; k < n; k++) await cells.nth(i).click({ force: true })
    }
    await expect(page.getByRole('heading', { name: 'Every field is watered.' })).toBeVisible()
    await expect(page.locator('#win-taps')).toHaveText(String(puzzle.par))
    await page.reload()
    await expect(page.locator('#hint')).toContainText('Solved')
    await expect(page.locator('.board.won')).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test('a tap in progress is saved across a reload', async ({ page }) => {
    await page.goto('/runnel/?nohelp')
    const cell = page.locator('.tiles > g.cell:not(.stone):not(.fixed)').nth(3)
    await cell.click()
    await cell.click()
    await page.reload()
    await expect(page.locator('#hud-taps')).toHaveText('2')
  })

  test('practice mode offers three sizes and a new puzzle', async ({ page }) => {
    await page.goto('/runnel/?nohelp')
    await page.getByRole('tab', { name: 'Practice' }).click()
    await expect(page.locator('#hud-title')).toContainText('Practice')
    const medium = await page.locator('.tiles > g.cell').count()
    await page.getByRole('button', { name: 'Large' }).click()
    expect(await page.locator('.tiles > g.cell').count()).toBeGreaterThan(medium)
    await page.getByRole('button', { name: 'Small' }).click()
    expect(await page.locator('.tiles > g.cell').count()).toBeLessThan(medium)
    await expect(page.getByRole('button', { name: 'New puzzle' })).toBeVisible()
  })

  test('keyboard players can move between tiles and turn them', async ({ page }) => {
    await page.goto('/runnel/?nohelp')
    await page.locator('.tiles > g.cell[tabindex="0"]').focus()
    // The daily puzzle changes with the date, and a sluice (.fixed) can't be turned: step right until
    // the focused tile is a turnable one.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight')
      const fixed = await page.evaluate(() => !!document.activeElement?.classList.contains('fixed'))
      if (!fixed) break
    }
    await page.keyboard.press('Enter')
    await expect(page.locator('#hud-taps')).toHaveText('1')
  })

  test('clicking a tile moves the roving tabindex so Tab returns there', async ({ page }) => {
    await page.goto('/runnel/?nohelp')
    const cells = page.locator('.tiles > g.cell:not(.stone)')
    const initial = page.locator('.tiles > g.cell[tabindex="0"]')
    await expect(initial).toHaveCount(1)
    const target = cells.nth(2)
    await target.click()
    // The tapped tile becomes the sole roving-tabindex stop, not just whatever last had DOM focus.
    await expect(page.locator('.tiles > g.cell[tabindex="0"]')).toHaveCount(1)
    await expect(target).toHaveAttribute('tabindex', '0')
  })

  test('has no serious or critical accessibility issues, before and during play', async ({ page }) => {
    await page.goto('/runnel/')
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
    await assertNoSeriousIssues(page)
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.tiles > g.cell')).not.toHaveCount(0)
    await assertNoSeriousIssues(page)
  })
})

const PLOT6: [number, number] = [1, 1]

/** Functional Hedgerow tests use the 2D renderer: headless Chromium's software WebGL is too slow to drive
 *  key by key. The 3D view gets its own load test below. */
const HEDGEROW_2D = '/hedgerow/?2d'

/** Selects a Hedgerow cell with the keyboard cursor (renderer-agnostic: the 3D view's cells aren't on a flat grid). */
async function selectCell(page: Page, col: number, row: number) {
  await page.locator('#canvas').focus()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowUp')
  }
  for (let i = 0; i < col; i++) await page.keyboard.press('ArrowRight')
  for (let i = 0; i < row; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
}

/** Both specialisation buttons (or, on fleet levels, the three paths' next tiers) are inside the panel, unscrolled, and nothing (such as a sticky Sell row) covers them. */
async function expectSpecChoiceVisible(page: Page, selector = 'button.spec') {
  const panel = (await page.locator('#panel').boundingBox())!
  for (const b of await page.locator(selector).all()) {
    await expect(b).toBeInViewport({ ratio: 1 })
    const box = (await b.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height)
    const uncovered = await b.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return [0.25, 0.5, 0.8].every((f) => {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * f)
        return !!hit && el.contains(hit)
      })
    })
    expect(uncovered).toBe(true)
  }
  expect(await page.locator('#panel').evaluate((el) => el.scrollTop)).toBe(0)
}

test.describe('Hedgerow', () => {
  test('story, build a scarecrow, send a wave', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto(HEDGEROW_2D)
    await expect(page.locator('button.level[data-level="2"]')).toBeDisabled()
    await page.locator('button.level[data-level="1"]').click()
    await expect(page.getByRole('dialog')).toContainText('Hollowell, a giant delivery company')
    // Next finishes the typing, then moves on; Skip ends the scene.
    await page.locator('#story-next').click()
    await page.locator('#story-skip').click()
    // Hedgerow 2 M2: level 1 plays the Fleet: 600 Marks, a 200-Mark Scarecrow, Round Book rounds 1-12.
    await expect(page.locator('#hud-marks')).toHaveText('600')
    await expect(page.locator('#btn-pie')).toBeHidden()
    // Tap a plot beside the lane (column 0, row 0 is grass in level 1).
    // The keyboard cursor starts on (0, 0), a plot in level 1; Enter selects it (works in 2D and 3D).
    await selectCell(page, 0, 0)
    await page.locator('button.btn-build[data-kind="scarecrow"]').click()
    await expect(page.locator('#hud-marks')).toHaveText('400')
    // Escape on the battlefield clears the selection and the panel goes back to the wave preview.
    await page.locator('#canvas').focus()
    await page.keyboard.press('Escape')
    await expect(page.locator('#panel')).toContainText('Round 1 of 12')
    await page.locator('#btn-send').click()
    await expect(page.locator('#hud-wave')).toHaveText('1/12')
    await expect(page.locator('#banner')).toContainText('Round 1')
    // Scan with the Next button in its stacking colour (it turns a second into the wave), so the
    // contrast check always sees the same state instead of racing it.
    await expect(page.locator('#btn-send')).toHaveClass(/early/, { timeout: 8000 })
    await noSideways(page)
    await assertNoSeriousIssues(page)
    expect(errors).toEqual([])
  })

  test("Cath's pie is available from level 3 and freezes a wave", async ({ page }) => {
    await page.goto(HEDGEROW_2D)
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 1, stars: { '1': 3, '2': 3 }, seenBefore: { '3': true } })))
    await page.reload()
    await page.locator('button.level[data-level="3"]').click()
    await expect(page.locator('#btn-pie')).toBeDisabled()
    await page.locator('#btn-send').click()
    await expect(page.locator('#btn-pie')).toBeEnabled({ timeout: 8000 })
    // First tap aims; the second throws at the front of the queue.
    await page.locator('#btn-pie').click()
    await expect(page.locator('#btn-pie')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('#btn-pie').click()
    await expect(page.locator('#btn-pie')).toContainText(/Pie \d+s/)
    await expect(page.locator('#btn-pie')).toBeDisabled()
    await noSideways(page)
  })

  test('a Scarecrow grows along a path to its tier 3 from level 6, and the sheet names it', async ({ page }) => {
    const errors = trackErrors(page)
    // Sandbox Marks: on the Fleet a tier 3 costs more than level 6 starts with.
    await page.goto(HEDGEROW_2D + '&sandbox=1')
    const stars: Record<string, number> = {}
    for (let i = 1; i <= 5; i++) stars[String(i)] = 3
    await page.evaluate((stars) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars, seenBefore: { '6': true }, tips: { spec: true } })), stars)
    await page.reload()
    await page.locator('button.level[data-level="6"]').click()
    await selectCell(page, PLOT6[0], PLOT6[1])
    await expect(page.locator('#panel')).toContainText('Scarecrow')
    await page.locator('button.btn-build[data-kind="scarecrow"]').click()
    // Hedgerow 2 M4: three paths; Flock's tier 3 is Crow Caller, and once bought the tower takes its name.
    await expect(page.locator('#panel')).toContainText('Flock')
    await expect(page.locator('#panel')).toContainText('Lookout')
    await expect(page.locator('#panel')).toContainText('Scythe')
    for (let i = 0; i < 3; i++) await page.locator('button.path-buy[data-path="0"]').click()
    await expect(page.locator('#panel .panel-title')).toContainText('Crow Caller')
    await expect(page.locator('#panel .build-chip')).toHaveText('3-0-0')
    expect(errors).toEqual([])
  })

  test('the Seed Bank spends stars on perks', async ({ page }) => {
    await page.goto(HEDGEROW_2D)
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars: { '1': 3, '2': 3 }, seenBefore: {} })))
    await page.reload()
    await expect(page.locator('#bank-stars')).toHaveText('6')
    await page.locator('#btn-bank').click()
    await page.getByRole('button', { name: /Buy Deep Pockets rank 1/ }).click()
    await expect(page.locator('#bank-free')).toContainText('5 stars')
    await page.locator('#bank-close').click()
    await expect(page.locator('#bank-stars')).toHaveText('5')
    await assertNoSeriousIssues(page)
  })

  test("Cath's character sheet spends skill points and picks a talent", async ({ page }) => {
    await page.goto(HEDGEROW_2D)
    const stars = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1), 3]))
    await page.evaluate((s) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars: s, seenBefore: {} })), stars)
    await page.reload()
    await expect(page.locator('#cath-level')).toHaveText('8')
    await page.locator('#btn-cath').click()
    await expect(page.locator('#cath-xp')).toContainText('7 skill points')
    await page.getByRole('button', { name: 'Raise Strength' }).click()
    await expect(page.locator('#cath-xp')).toContainText('6 skill points')
    await page.getByRole('button', { name: /Iron Pin/ }).click()
    await expect(page.getByRole('button', { name: /Iron Pin/ })).toHaveAttribute('aria-pressed', 'true')
    await assertNoSeriousIssues(page)
    await page.locator('#cath-close').click()
  })

  test('the 3D battlefield loads without errors', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/hedgerow/')
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars: {}, seenBefore: { '1': true }, tips: { build: true } })))
    await page.reload()
    await page.locator('button.level[data-level="1"]').click()
    await expect(page.locator('#hud-wave')).toHaveText('0/12')
    await page.waitForTimeout(1500)
    expect(errors).toEqual([])
  })

  test('a shared replay link plays the run back', async ({ page }) => {
    const errors = trackErrors(page)
    const setup = { mode: 'level' as const, id: 1, heroic: false, perks: NO_PERKS }
    const rec = new Recorder(setup)
    const g = startGame(LEVELS[0]!, setup)
    rec.act(g, { t: 'place', kind: 'scarecrow', col: 0, row: 0 })
    rec.act(g, { t: 'wave' })
    for (let i = 0; i < 240; i++) rec.step(g)
    const link = await encodeReplay(rec.replay())
    await page.goto(HEDGEROW_2D)
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars: {}, seenBefore: { '1': true }, tips: { build: true } })))
    await page.goto(`${HEDGEROW_2D}#replay=${link}`)
    await page.reload()
    await expect(page.locator('#replay-bar')).toBeVisible()
    await expect(page.locator('#hud-title')).toContainText('Replay')
    await expect(page.locator('#hud-wave')).toHaveText('1/12', { timeout: 10_000 })
    await page.locator('#replay-exit').click()
    await expect(page.locator('#screen-select')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('Hedgerow 2 M1: Go, stack the next wave and speed in one pill at 844x390', async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto(HEDGEROW_2D)
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars: {}, seenBefore: { '1': true }, tips: { build: true, hero: true, early: true } })))
    await page.reload()
    await page.locator('button.level[data-level="1"]').click()
    // Keep Going is off (and hidden) on levels 1-5; x5 only after a win.
    await expect(page.locator('#btn-auto')).toBeHidden()
    await expect(page.locator('#btn-send')).toHaveText('Go')
    await page.locator('#btn-speed').click()
    await expect(page.locator('#btn-speed')).toHaveText('x3')
    await page.locator('#btn-speed').click()
    await expect(page.locator('#btn-speed')).toHaveText('x1')
    await page.locator('#btn-send').click()
    await expect(page.locator('#hud-wave')).toHaveText('1/12')
    // During the wave the same button stacks the next one on top, for the early bonus.
    await expect(page.locator('#btn-send')).toHaveText(/^Next \+\d+$/, { timeout: 8000 })
    const before = Number(await page.locator('#hud-marks').textContent())
    const bonus = Number((await page.locator('#btn-send').textContent())!.replace(/\D/g, ''))
    await page.locator('#btn-send').click()
    await expect(page.locator('#hud-wave')).toHaveText('2/12')
    // On the Fleet the Marks counter rolls up towards the purse, so give it a moment to catch up.
    await expect.poll(async () => Number(await page.locator('#hud-marks').textContent()), { timeout: 5000 }).toBeGreaterThanOrEqual(before + bonus)
    await expect(page.locator('#banner')).toContainText('Stacked early')
    // The whole pill is on screen.
    for (const id of ['#btn-send', '#btn-speed']) {
      const box = (await page.locator(id).boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(390)
      expect(box.x + box.width).toBeLessThanOrEqual(844)
    }
    // Cath holds her post during a wave.
    await page.locator('#btn-hero').click()
    await expect(page.locator('#toast')).toContainText('holds her post')
    await noSideways(page)
    expect(errors).toEqual([])
  })

  test('Hedgerow 2 M1: picking Cath up holds the Keep Going countdown, and the round puts her down', async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto(HEDGEROW_2D + '&sandbox=1&level=6')
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars: {}, seenBefore: { '6': true }, tips: { build: true, hero: true, early: true } })))
    await page.reload()
    await expect(page.locator('#btn-send')).toHaveText('Go', { timeout: 8000 })
    await page.locator('#btn-send').click()
    await expect(page.locator('#hud-wave')).toHaveText(/^3\//)
    // Clear the first round (Book round 3: level 6 plays rounds 3-15) by hand: Keep Going (on from level 6) starts its 2 s countdown.
    await page.evaluate(() => {
      const g = (window as unknown as { hedgerow: { game(): { spawnQueue: unknown[]; enemies: unknown[] } } }).hedgerow.game()
      g.spawnQueue.length = 0
      g.enemies.length = 0
    })
    await expect(page.locator('#btn-send')).toHaveText(/^Round 4 in/, { timeout: 8000 })
    await page.locator('#btn-hero').click()
    await expect(page.locator('#choose-chip')).toBeVisible()
    await page.waitForTimeout(3000)
    await expect(page.locator('#hud-wave')).toHaveText(/^3\//)
    await expect(page.locator('#btn-send')).toHaveText(/^Round 4 in/)
    // Go starts the round and puts her down: the next tap is for the field again.
    await page.locator('#btn-send').click()
    await expect(page.locator('#hud-wave')).toHaveText(/^4\//)
    await expect(page.locator('#choose-chip')).toBeHidden()
    await page.locator('#btn-hero').click()
    await expect(page.locator('#toast')).toContainText('holds her post')
    expect(errors).toEqual([])
  })

  test('Hedgerow 2 M4: a Scarecrow\'s three paths show side by side on a landscape phone without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto(HEDGEROW_2D + '&sandbox=1')
    const stars: Record<string, number> = {}
    for (let i = 1; i <= 5; i++) stars[String(i)] = 3
    await page.evaluate((stars) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars, seenBefore: { '6': true }, tips: { spec: true } })), stars)
    await page.reload()
    await page.locator('button.level[data-level="6"]').click()
    // From level 6 Keep Going is on by default.
    await expect(page.locator('#btn-auto')).toHaveAttribute('aria-pressed', 'true')
    await selectCell(page, PLOT6[0], PLOT6[1])
    await page.locator('button.btn-build[data-kind="scarecrow"]').click()
    // Fleet levels: the tower sheet has three path columns, each with its next tier ready to buy.
    await expect(page.locator('#panel .path-col')).toHaveCount(3)
    await page.locator('button.path-buy[data-path="0"]').click()
    await page.locator('button.path-buy[data-path="0"]').click()
    await expect(page.locator('#panel .build-chip')).toHaveText('2-0-0')
    await expect(page.locator('button.path-buy')).toHaveCount(3)
    await expectSpecChoiceVisible(page, 'button.path-buy')
    // The sheet docks to one side, so the tower being grown stays in view beside it (M4 review).
    const at = await page.evaluate(([c, r]) => (window as unknown as { hedgerow: { cellCenter(c: number, r: number): { x: number; y: number } } }).hedgerow.cellCenter(c, r), PLOT6)
    const sheet = (await page.locator('#panel').boundingBox())!
    expect(at.x < sheet.x || at.x > sheet.x + sheet.width).toBe(true)
  })

  test('Hedgerow 2 M4: buys every path of all five path towers at 844x390, and the crosspath rule shuts the third', async ({ page }) => {
    test.setTimeout(180_000)
    const errors = trackErrors(page)
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto(HEDGEROW_2D + '&sandbox=1&level=30')
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { '30': true }, tips: { build: true, hero: true, early: true, spec: true } })))
    await page.reload()
    await expect(page.locator('#btn-send')).toBeVisible({ timeout: 10_000 })
    // Free plots, found through the sandbox hook (placing then selling leaves the plot empty and the Marks as they were).
    const plots = await page.evaluate(() => {
      type G = { level: { rows: number; cols: number }; towers: Array<{ id: number }>; marks: number }
      const H = (window as unknown as { hedgerow: { game(): G; place(g: G, k: string, c: number, r: number): { ok: boolean } } }).hedgerow
      const g = H.game()
      const out: Array<[number, number]> = []
      for (let r = 0; r < g.level.rows; r++)
        for (let c = 0; c < g.level.cols; c++)
          if (H.place(g, 'cannon', c, r).ok) {
            g.towers.pop()
            out.push([c, r])
          }
      return out
    })
    expect(plots.length).toBeGreaterThanOrEqual(10)
    let k = 0
    for (const kind of ['scarecrow', 'hedgerow', 'beehive', 'cannon', 'mast']) {
      // One tower takes path A to tier 3 and B to tier 2, which shuts C; a second takes C to tier 3.
      for (const plan of [[0, 0, 0, 1, 1], [2, 2, 2]]) {
        const [c, r] = plots[k++]!
        await selectCell(page, c, r)
        await page.locator(`button.btn-build[data-kind="${kind}"]`).click()
        await page.keyboard.press('Escape')
        await selectCell(page, c, r)
        await expect(page.locator('#panel .path-col')).toHaveCount(3)
        for (const i of plan) {
          const buy = page.locator(`button.path-buy[data-path="${i}"]`)
          await expect(buy).toBeInViewport()
          await buy.click()
        }
        const want = plan.length === 5 ? '3-2-0' : '0-0-3'
        await expect(page.locator('#panel .build-chip')).toHaveText(want)
        if (plan.length === 5) {
          await expect(page.locator('#panel .path-col[data-path="2"]')).toHaveClass(/shut/)
          await expect(page.locator('button.path-buy[data-path="2"]')).toBeDisabled()
          await expect(page.locator('button.path-buy[data-path="2"] .path-eta')).toContainText('two paths')
        }
        await page.locator('#panel .sheet-close').click()
        await expect(page.locator('#panel .path-col')).toHaveCount(0)
      }
    }
    const builds = await page.evaluate(() => (window as unknown as { hedgerow: { game(): { towers: Array<{ kind: string; path?: number[] }> } } }).hedgerow.game().towers.map((t) => `${t.kind}:${t.path?.join('')}`))
    expect(builds).toHaveLength(10)
    expect(builds.filter((b) => b.endsWith(':320'))).toHaveLength(5)
    expect(builds.filter((b) => b.endsWith(':003'))).toHaveLength(5)
    await noSideways(page)
    expect(errors).toEqual([])
  })

  // Portrait too (M4 review): the fixed-height phone panel used to squeeze the tray to a 4 px sliver there.
  for (const [w, h] of [[844, 390], [390, 844]] as const)
  test(`Hedgerow 2 M4: a tower dragged from the tray onto a plot is built there at ${w}x${h}`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto(HEDGEROW_2D + '&sandbox=1&level=1')
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { '1': true }, tips: { build: true, hero: true, early: true } })))
    await page.reload()
    const tray = page.locator('#panel .tray-tower[data-kind="scarecrow"]')
    await expect(tray).toBeVisible({ timeout: 10_000 })
    // The tray is a real row of towers, not a squeezed sliver, and the preview chips under it aren't crushed.
    expect((await page.locator('#panel .tray').boundingBox())!.height).toBeGreaterThanOrEqual(48)
    const chips = await page.locator('#panel .preview-row').boundingBox()
    if (chips) expect(chips.height).toBeGreaterThanOrEqual(24)
    // Level 1's top-left cell (0, 0) is grass: where is it on screen?
    const cell = await page.evaluate(() => (window as unknown as { hedgerow: { cellCenter(c: number, r: number): { x: number; y: number } } }).hedgerow.cellCenter(0, 0))
    const from = (await tray.boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x - 40, from.y - 40, { steps: 4 })
    await expect(page.locator('.drag-ghost')).toBeVisible()
    await page.mouse.move(cell.x, cell.y, { steps: 6 })
    await page.mouse.up()
    await expect(page.locator('.drag-ghost')).toHaveCount(0)
    const towers = await page.evaluate(() => (window as unknown as { hedgerow: { game(): { towers: Array<{ kind: string; col: number; row: number }> } } }).hedgerow.game().towers)
    expect(towers).toEqual([expect.objectContaining({ kind: 'scarecrow', col: 0, row: 0 })])
    // A plain tap on the tray explains the drag instead of building anything (a click right as a drag ends is
    // the drag's own, so wait a moment first).
    await page.waitForTimeout(500)
    await tray.click()
    await expect(page.locator('#toast')).toContainText('Drag the Scarecrow')
    expect(errors).toEqual([])
  })

  // Later levels crowd the tray (Neighbours from 12, Rally from 25), which squeezes the panel; and the iPhone SE
  // is the shortest portrait phone. The choice must still show, uncovered by the Sell row, and Go must stay legible.
  for (const [w, h] of [[844, 390], [375, 667], [390, 844]] as const) {
    for (const level of [12, 40]) {
      test(`Hedgerow 2 M1: spec choice and Go pill fit at ${w}x${h} on level ${level}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'site-phone', 'a phone layout check')
        await page.setViewportSize({ width: w, height: h })
        await page.goto(`${HEDGEROW_2D}&sandbox=1`)
        const stars: Record<string, number> = {}
        for (let i = 1; i < level; i++) stars[String(i)] = 3
        await page.evaluate(
          ([stars, level]) =>
            localStorage.setItem(
              'hedgerow:v1',
              JSON.stringify({ version: 2, stars, seenBefore: { [level]: true }, tips: { spec: true, build: true, hero: true, early: true, pie: true, neighbours: true, rally: true } }),
            ),
          [stars, level] as const,
        )
        await page.reload()
        await page.locator(`button.level[data-level="${level}"]`).click()
        const pos = await page.evaluate(() => {
          type T = { id: number }
          type G = { level: { rows: number; cols: number }; towers: T[] }
          const H = (window as unknown as { hedgerow: { game(): G; place(g: G, k: string, c: number, r: number): { ok: boolean }; upgrade(g: G, id: number, choice?: number): unknown } }).hedgerow
          const g = H.game()
          for (let r = 0; r < g.level.rows; r++)
            for (let c = 0; c < g.level.cols; c++)
              if (H.place(g, 'scarecrow', c, r).ok) {
                const t = g.towers.at(-1)!
                // Fleet levels (M4) grow along a path; classic ones take tiers.
                H.upgrade(g, t.id, 0)
                H.upgrade(g, t.id, 0)
                return [c, r] as const
              }
          return null
        })
        expect(pos).not.toBeNull()
        await selectCell(page, pos![0], pos![1])
        const sel = level <= 30 ? 'button.path-buy' : 'button.spec'
        await expect(page.locator(sel)).toHaveCount(level <= 30 ? 3 : 2)
        await expectSpecChoiceVisible(page, sel)
        await page.keyboard.press('Escape')
        await page.locator('#btn-send').click()
        await expect(page.locator('#btn-send')).toHaveText(/^Next \+\d+$/, { timeout: 8000 })
        expect(await page.locator('#btn-send').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
        await noSideways(page)
      })
    }
  }

  test('Hedgerow 2 M1: the story moves on one tap per line', async ({ page }) => {
    await page.goto(HEDGEROW_2D)
    await page.locator('button.level[data-level="1"]').click()
    const first = await page.locator('#story-full').textContent()
    await page.locator('#story-next').click()
    await expect(page.locator('#story-full')).not.toHaveText(first!)
  })

  test('keeps progress in localStorage', async ({ page }) => {
    await page.goto(HEDGEROW_2D)
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 1, stars: { '1': 2 }, seenBefore: { '1': true } })))
    await page.reload()
    await expect(page.locator('button.level[data-level="2"]')).toBeEnabled()
    await expect(page.locator('button.level[data-level="1"] .level-stars')).toHaveText('★★☆')
  })
})

test.describe('CATHODE', () => {
  test('asks for age first, then shows the title, accessibly and without sideways scroll', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/cathode/')
    await expect(page.locator('#screen-gate')).toBeVisible()
    await expect(page.locator('#screen-title')).toBeHidden()
    await assertNoSeriousIssues(page)
    await page.getByRole('radio', { name: /Reduced.*no gore/ }).check()
    await page.getByRole('button', { name: "I'm 18 or over" }).click()
    await expect(page.locator('#screen-title')).toBeVisible()
    await expect(page.locator('#title-word')).toHaveText('CATHODE')
    await noSideways(page)
    await assertNoSeriousIssues(page)
    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('cathode:prefs:v1') ?? '{}'))
    expect(prefs).toMatchObject({ adult: true, intensity: 'reduced' })
    await page.reload()
    await expect(page.locator('#screen-title')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the street boots and renders frames without errors', async ({ page }) => {
    // The full street renders at well under 1 fps on the CI's software GPU.
    test.setTimeout(240_000)
    const errors = trackErrors(page)
    await page.goto('/cathode/')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/cathode/?play&shot')
    await page.waitForFunction(() => ((window as unknown as { cathode?: { stats: { frames: number } } }).cathode?.stats.frames ?? 0) >= 1, null, { timeout: 200_000 })
    await expect(page.locator('#loading')).toBeHidden()
    // A portrait touch screen waits behind "turn your phone sideways".
    const portraitTouch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth)
    if (portraitTouch) await expect(page.locator('.rotate')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the landing page links to it with an 18+ badge', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('a[href="/cathode/"]')
    await expect(card).toContainText('18+')
  })
})
