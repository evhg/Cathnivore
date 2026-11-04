import { test, expect, type Page } from '@playwright/test'

// Plan item 11: the enemy turn is played in the boardroom strip, with both HQs on the map and each step's
// pieces flying out of them. A tap still skips the whole turn (SPEC 10.2), and reduced motion only fades.

async function playToEnemyTurn(page: Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByLabel('Hot-seat (two humans)').check()
  await page.getByRole('button', { name: 'Start' }).click()
  const graft = () => page.getByRole('button', { name: /^Graft:/ }).click({ force: true })
  for (let i = 0; i < 3; i++) await graft()
  await page.getByRole('button', { name: "I'm ready" }).click()
  for (let i = 0; i < 3; i++) await graft()
  await expect(page.locator('.enemy-turn-playback.boardroom')).toBeVisible()
}

test('the boardroom strip shows a face and the HQs, flies a piece, and a tap skips the turn', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await playToEnemyTurn(page)

  await expect(page.locator('.enemy-turn-layer [data-hq="hollowell"]')).toBeAttached()
  await expect(page.locator('.enemy-turn-layer [data-hq="candor"]')).toBeAttached()
  // Round 1's pressure always places pieces (Expand or Scout), so some step flies one.
  await expect(page.locator('.enemy-turn-layer .flight[data-flight]').first()).toBeAttached({ timeout: 8_000 })
  await expect(page.locator('.boardroom-face svg')).toBeVisible()

  await page.locator('.enemy-turn-playback').click()
  await expect(page.locator('.enemy-turn-playback')).toHaveCount(0)
  await expect(page.locator('.enemy-turn-layer')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Graft:/ })).toBeEnabled()
  expect(errors).toEqual([])
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('pieces fade in on their hex instead of flying', async ({ page }) => {
    await playToEnemyTurn(page)
    const piece = page.locator('.enemy-turn-layer .flight-piece').first()
    await expect(piece).toBeAttached({ timeout: 8_000 })
    expect(await piece.evaluate((el) => getComputedStyle(el).animationName)).toBe('flight-fade')
    expect(await page.locator('.boardroom-row, .boardroom-cath').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('boardroom-fade')
  })
})

// Plan item 33: the strip plays in the Actions area, so it covers no hex and nothing in it is cut off.
test('the boardroom strip covers no hex and is not clipped', async ({ page }) => {
  await playToEnemyTurn(page)
  // Measured once the step's card has finished flipping in (its rotateY overshoots the box mid-flip).
  await page.waitForTimeout(600)
  const m = await page.evaluate(() => {
    const strip = document.querySelector('.enemy-turn-playback')!
    const s = strip.getBoundingClientRect()
    const hits = [...document.querySelectorAll('.region-hex polygon')]
      .map((p) => p.getBoundingClientRect())
      .filter((t) => t.width > 40 && t.left < s.right && t.right > s.left && t.top < s.bottom && t.bottom > s.top).length
    return { hits, clipped: strip.scrollHeight > strip.clientHeight + 1, inActions: !!strip.closest('.actions') }
  })
  expect(m).toEqual({ hits: 0, clipped: false, inActions: true })
})

// Plan item 92: the corporate turn is staged. Each step's pieces appear on the map only when that step
// plays (under its flight), not all at once under the first one: the map's enemy pieces, sampled at every
// step of the ledger, never fall, and rise during the turn rather than before it.
test('each board change waits for its step', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { samples: { step: number; pieces: number; t: number }[] }
    w.samples = []
    const tick = () => {
      const now = document.querySelectorAll('.boardroom-ledger li')
      if (now.length) {
        const step = [...now].findIndex((li) => li.getAttribute('data-ledger-step') === 'now')
        const pieces = [...document.querySelectorAll('[data-enemy-pieces]')].reduce((n, g) => n + Number(g.getAttribute('data-enemy-pieces')), 0)
        w.samples.push({ step: step === -1 ? now.length : step, pieces, t: performance.now() })
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await playToEnemyTurn(page)
  await expect(page.locator('.enemy-turn-playback')).toHaveCount(0, { timeout: 20_000 })
  const samples = await page.evaluate(() => (window as unknown as { samples: { step: number; pieces: number; t: number }[] }).samples)
  const steps = new Set(samples.map((s) => s.step))
  expect(steps.size).toBeGreaterThanOrEqual(3)
  for (let i = 1; i < samples.length; i++) expect(samples[i]!.pieces).toBeGreaterThanOrEqual(samples[i - 1]!.pieces)
  const first = samples[0]!
  const last = samples[samples.length - 1]!
  expect(last.pieces).toBeGreaterThan(first.pieces)
  // Nothing has landed when the turn opens: a flown piece reaches its hex 640 ms into its step.
  expect(samples.filter((s) => s.t - first.t < 400).every((s) => s.pieces === first.pieces)).toBe(true)
})

// Plan item 92: phones meet Hollowell's face in the strip on its turn (no permanent bust there), 56 px or more.
test('Hollowell\'s face in the strip is 56 px or more', async ({ page }) => {
  await playToEnemyTurn(page)
  const face = page.locator('.boardroom-hollowell .boardroom-face').first()
  await expect(face).toBeVisible({ timeout: 8_000 })
  const box = (await face.boundingBox())!
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56)
})
