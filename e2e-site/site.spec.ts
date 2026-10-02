import { expect, test, type Page } from '@playwright/test'
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
    const cell = page.locator('.tiles > g.cell:not(.stone)').nth(3)
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

test.describe('Hedgerow', () => {
  test('story, build a scarecrow, send a wave', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto(HEDGEROW_2D)
    await expect(page.locator('button.level[data-level="2"]')).toBeDisabled()
    await page.locator('button.level[data-level="1"]').click()
    await expect(page.getByRole('dialog')).toContainText('drone over my bottom field')
    // Next finishes the typing, then moves on; Skip ends the scene.
    await page.locator('#story-next').click()
    await page.locator('#story-skip').click()
    await expect(page.locator('#hud-marks')).toHaveText('210')
    await expect(page.locator('#btn-pie')).toBeHidden()
    // Tap a plot beside the lane (column 0, row 0 is grass in level 1).
    // The keyboard cursor starts on (0, 0), a plot in level 1; Enter selects it (works in 2D and 3D).
    await selectCell(page, 0, 0)
    await page.locator('button.btn-build[data-kind="scarecrow"]').click()
    await expect(page.locator('#hud-marks')).toHaveText('130')
    // Escape on the battlefield clears the selection and the panel goes back to the wave preview.
    await page.locator('#canvas').focus()
    await page.keyboard.press('Escape')
    await expect(page.locator('#panel')).toContainText('Wave 1 of 5')
    await page.locator('#btn-send').click()
    await expect(page.locator('#hud-wave')).toHaveText('1/5')
    await expect(page.locator('#banner')).toContainText('Wave 1')
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

  test('a tower grows to tier 3 and specialises from level 6', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto(HEDGEROW_2D)
    const stars: Record<string, number> = {}
    for (let i = 1; i <= 5; i++) stars[String(i)] = 3
    await page.evaluate((stars) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 2, stars, seenBefore: { '6': true }, tips: { spec: true } })), stars)
    await page.reload()
    await page.locator('button.level[data-level="6"]').click()
    await selectCell(page, PLOT6[0], PLOT6[1])
    await expect(page.locator('#panel')).toContainText('Scarecrow')
    await page.locator('button.btn-build[data-kind="scarecrow"]').click()
    await page.locator('#btn-upgrade').click()
    await page.locator('#btn-upgrade').click()
    await expect(page.locator('button.spec')).toHaveCount(2)
    await expect(page.locator('#panel')).toContainText('Pumpkin Lobber')
    await expect(page.locator('#panel')).toContainText('Crow Caller')
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
    await expect(page.locator('#hud-wave')).toHaveText('0/5')
    await page.waitForTimeout(1500)
    expect(errors).toEqual([])
  })

  test('keeps progress in localStorage', async ({ page }) => {
    await page.goto(HEDGEROW_2D)
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 1, stars: { '1': 2 }, seenBefore: { '1': true } })))
    await page.reload()
    await expect(page.locator('button.level[data-level="2"]')).toBeEnabled()
    await expect(page.locator('button.level[data-level="1"] .level-stars')).toHaveText('★★☆')
  })
})
