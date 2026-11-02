import { test, expect, type Page } from '@playwright/test'

// Plan item 32: chapter 2 ("Word of Mouth") is taught on the board by the same spotlight coach as
// chapter 1 (content/chapters.ts CHAPTER_2.tutorialSteps): Doubt and Rebut, Goodwill, Public Trust and
// Sol's free On Air, then a liberation in round 2. These tests click only what the coach spotlights.
// Every step is shot to e2e/screenshots/coach2/ (gitignored) for the item's "shots of each step".

const TOTAL = 13

async function startChapter2(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Word of Mouth/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.coach')).toBeVisible()
}

async function followOneStep(page: Page): Promise<string> {
  const step = (await page.locator('.coach-count').textContent()) ?? ''
  const next = page.locator('.coach-primary')
  if (await next.count()) {
    await next.click()
  } else {
    const target = await page.locator('.coach').getAttribute('data-for')
    expect(target, `${step} has something to tap`).toBeTruthy()
    await page.locator(`[data-tutorial="${target}"]`).click()
  }
  return step
}

test('a fresh save walks chapter 2\'s coach to free play, clicking only the spotlit targets', async ({ page }, testInfo) => {
  test.setTimeout(120_000) // a shot per step
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await startChapter2(page)

  const coach = page.locator('.coach')
  const actions = page.locator('.actions')
  await expect(page.locator('.coach-count')).toHaveText(`Step 1 of ${TOTAL}`)
  // The old prompt strip is retired from the campaign.
  await expect(page.locator('.tutorial-prompt')).toHaveCount(0)

  const seen: string[] = []
  let shot = 0
  for (let i = 0; i < 40 && (await coach.count()) > 0; i++) {
    const target = await coach.getAttribute('data-for')
    const step = (await page.locator('.coach-count').textContent()) ?? ''
    if (target === 'action') await expect(actions.locator('[data-tutorial="action"]')).toHaveCount(1)
    if (target) {
      const el = page.locator(`[data-tutorial="${target}"]`)
      await el.scrollIntoViewIfNeeded()
      const box = await el.boundingBox()
      expect(box, `${step}: ${target} on screen`).not.toBeNull()
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('.coach-block') !== null, [box!.x + box!.width / 2, box!.y + box!.height / 2])
      expect(hit, `${step}: ${target} not covered by the dimmer`).toBe(false)
    }
    await page.waitForTimeout(250)
    await page.screenshot({ path: `e2e/screenshots/coach2/${testInfo.project.name}-${String(++shot).padStart(2, '0')}-${target ?? 'card'}.png` })
    seen.push(await followOneStep(page))
  }
  expect(new Set(seen).size).toBe(TOTAL)
  await expect(coach).toHaveCount(0)

  // The hand-off: round 2, Rivermead liberated, free play with Graft back and one action to spend.
  await expect(page.locator('.region-hex[aria-label="Rivermead"] .liberate-bloom')).toHaveCount(1)
  await expect(actions.getByRole('button', { name: /^Graft/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  // Done once: the chapter no longer starts on the coach, and the card offers it again.
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('button', { name: 'Replay the walkthrough' })).toBeVisible()
  await page.getByRole('button', { name: /^Word of Mouth/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.active-producer')).toBeVisible()
  await expect(coach).toHaveCount(0)
  await expect(page.locator('.tutorial-prompt')).toHaveCount(0)

  expect(errors).toEqual([])
})

test('a reload mid-coach in chapter 2 resumes on the same step', async ({ page }) => {
  await startChapter2(page)
  // Steps 1-3 explain, step 4 is Rebut (button, Saltmarsh, Confirm), step 5 Supply likewise.
  for (let i = 0; i < 3 + 3 + 3; i++) await followOneStep(page)
  await expect(page.locator('.coach-count')).toHaveText(`Step 6 of ${TOTAL}`)
  await page.reload()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.coach-count')).toHaveText(`Step 6 of ${TOTAL}`)
  // On Air next (step 7): one tap, no map.
  await followOneStep(page)
  await expect(page.locator('.coach-count')).toHaveText(`Step 7 of ${TOTAL}`)
  await followOneStep(page)
  await expect(page.locator('.coach-count')).toHaveText(`Step 8 of ${TOTAL}`)
})

test('chapter 2\'s coach can be skipped and replayed from its campaign card', async ({ page }) => {
  await startChapter2(page)
  await page.getByRole('button', { name: 'Skip tutorial' }).click()
  await page.getByRole('button', { name: 'Yes, skip it' }).click()
  await expect(page.locator('.coach')).toHaveCount(0)
  await expect(page.locator('.actions').getByRole('button', { name: /^Graft/ })).toBeVisible()
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Replay the walkthrough' }).click()
  await expect(page.locator('.coach-count')).toHaveText(`Step 1 of ${TOTAL}`)
})
