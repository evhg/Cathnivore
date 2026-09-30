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
    await page.keyboard.press('ArrowRight')
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

test.describe('Hedgerow', () => {
  test('story, build a scarecrow, send a wave', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/hedgerow/')
    await expect(page.locator('button.level[data-level="2"]')).toBeDisabled()
    await page.locator('button.level[data-level="1"]').click()
    await expect(page.getByRole('dialog')).toContainText('Mara is halfway through a cheese sandwich')
    for (let i = 0; i < 4; i++) await page.locator('#story-next').click()
    await expect(page.locator('#hud-marks')).toHaveText('210')
    // Tap a plot beside the lane (column 0, row 0 is grass in level 1).
    const box = (await page.locator('#canvas').boundingBox())!
    const cell = Math.floor(Math.min(box.width / 6, box.height / 7))
    const offX = Math.floor((box.width - cell * 6) / 2)
    const offY = Math.floor((box.height - cell * 7) / 2)
    await page.mouse.click(box.x + offX + cell * 0.5, box.y + offY + cell * 0.5)
    await page.locator('button.btn-build[data-kind="scarecrow"]').click()
    await expect(page.locator('#hud-marks')).toHaveText('130')
    await page.locator('#btn-send').click()
    await expect(page.locator('#hud-wave')).toHaveText('1/5')
    await noSideways(page)
    await assertNoSeriousIssues(page)
    expect(errors).toEqual([])
  })

  test('keeps progress in localStorage', async ({ page }) => {
    await page.goto('/hedgerow/')
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 1, stars: { '1': 2 }, seenBefore: { '1': true } })))
    await page.reload()
    await expect(page.locator('button.level[data-level="2"]')).toBeEnabled()
    await expect(page.locator('button.level[data-level="1"] .level-stars')).toHaveText('★★☆')
  })
})
