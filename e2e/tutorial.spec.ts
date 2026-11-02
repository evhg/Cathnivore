import { test, expect, type Page } from '@playwright/test'

// SPEC 11.4 gate 5: "campaign chapter 1 is completed by following the tutorial prompts, with the test
// clicking the highlighted elements." Chapter 1 is the guided tutorial (ui/TutorialCoach.tsx): a
// spotlight on exactly one element per step, everything else dimmed and blocked. The coach names the
// spotlit element in `data-for`; these tests click only that element (or the card's own Next).

async function startChapter1(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.coach')).toBeVisible()
}

// Clicks whatever the tutorial points at, once, and returns the step it was on.
async function followOneStep(page: Page): Promise<string> {
  const coach = page.locator('.coach')
  const step = (await page.locator('.coach-count').textContent()) ?? ''
  const next = page.locator('.coach-primary')
  if (await next.count()) {
    await next.click()
  } else {
    const target = await coach.getAttribute('data-for')
    expect(target, `${step} has something to tap`).toBeTruthy()
    await page.locator(`[data-tutorial="${target}"]`).click()
  }
  return step
}

test('the guided tutorial walks chapter 1\'s first round end to end, clicking only the spotlit targets', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await startChapter1(page)

  const coach = page.locator('.coach')
  const actions = page.locator('.actions')
  await expect(page.locator('.coach-count')).toHaveText('Step 1 of 15')
  // The prompt strip is gone in favour of the coach, and nothing is clickable but the card itself.
  await expect(page.locator('.tutorial-prompt')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()

  const seen: string[] = []
  for (let i = 0; i < 40 && (await coach.count()) > 0; i++) {
    const target = await coach.getAttribute('data-for')
    const step = await page.locator('.coach-count').textContent()
    // Hard gate: while an action step shows, the panel offers that one action and nothing else.
    if (target === 'action') {
      await expect(actions.locator('[data-tutorial="action"]')).toHaveCount(1)
      await expect(actions.getByRole('button', { name: /^Graft/ })).toHaveCount(step === 'Step 10 of 15' ? 1 : 0)
    }
    // The spotlit element is really on top: a click there reaches it, not a blocker.
    if (target) {
      const box = await page.locator(`[data-tutorial="${target}"]`).boundingBox()
      expect(box, `${step}: ${target} on screen`).not.toBeNull()
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('.coach-block') !== null, [box!.x + box!.width / 2, box!.y + box!.height / 2])
      expect(hit, `${step}: ${target} not covered by the dimmer`).toBe(false)
    }
    seen.push(await followOneStep(page))
  }
  expect(new Set(seen).size).toBe(15)
  await expect(coach).toHaveCount(0)

  // The hand-off: round 2, Highmoor liberated, one Outlet left in Brindle Hills, free play with Graft back.
  await expect(page.locator('.region-hex[aria-label="Highmoor"] .liberate-bloom')).toHaveCount(1)
  await expect(actions.getByRole('button', { name: /^Graft/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  // First time only: back on the campaign it no longer starts on its own, and can be replayed.
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('button', { name: 'Replay the tutorial' })).toBeVisible()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.active-producer')).toBeVisible()
  await expect(coach).toHaveCount(0)

  expect(errors).toEqual([])
})

test('the tutorial can be skipped (Escape asks first), stays skipped, and replays from Settings', async ({ page }) => {
  await startChapter1(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('.coach-confirm')).toBeVisible()
  await page.getByRole('button', { name: 'Keep going' }).click()
  await expect(page.locator('.coach-confirm')).toHaveCount(0)

  await page.getByRole('button', { name: 'Skip tutorial' }).click()
  await page.getByRole('button', { name: 'Yes, skip it' }).click()
  await expect(page.locator('.coach')).toHaveCount(0)
  // Free play straight away: every legal action is offered.
  await expect(page.locator('.actions').getByRole('button', { name: /^Graft/ })).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Replay the tutorial' }).click()
  await expect(page.locator('.coach')).toBeVisible()
  await expect(page.locator('.coach-count')).toHaveText('Step 1 of 15')
})

test('the tutorial is keyboard-playable: focus lands on each target and Tab stays inside the step', async ({ page }) => {
  await startChapter1(page)
  // Explain steps focus the card's Next; Enter moves on.
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('.coach-primary')).toBeFocused()
    await page.keyboard.press('Enter')
  }
  // Step 7: focus is on the one action, Tab only cycles between it and the card's buttons.
  await expect(page.locator('[data-tutorial="action"]')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.coach-rules')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.coach-skip')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-tutorial="action"]')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('.coach-skip')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-tutorial="action"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-tutorial="region-highmoor"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-tutorial="confirm"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.coach-count')).toHaveText('Step 8 of 15')
})

// A reload mid-tutorial resumes the script just after the last action already taken.
test('a reload mid-tutorial picks the script back up where it was', async ({ page }) => {
  await startChapter1(page)
  for (let i = 0; i < 9; i++) await followOneStep(page) // through step 7's Open Stall (3 clicks)
  await expect(page.locator('.coach-count')).toHaveText('Step 8 of 15')
  await page.reload()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.coach-count')).toHaveText('Step 8 of 15')
})
// Chapter 2's coach (plan item 32) has its own spec: e2e/tutorial-ch2.spec.ts.

// SPEC 8.1: "a '?' link to the rules reference" alongside every tutorial prompt: Cath's card has one.
test('the tutorial card\'s "?" opens the rules reference and returns to the same step on close', async ({ page }) => {
  await startChapter1(page)
  for (let i = 0; i < 6; i++) await followOneStep(page)
  await expect(page.locator('.coach-count')).toHaveText('Step 7 of 15')

  await page.getByRole('button', { name: 'Open the rules reference' }).click()
  await expect(page.locator('.rules-reference')).toBeVisible()
  await expect(page.locator('.coach')).toHaveCount(0)

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.rules-reference')).toHaveCount(0)
  // Back on the same in-progress game and step, with the same gate.
  await expect(page.locator('.coach-count')).toHaveText('Step 7 of 15')
  await expect(page.locator('.actions').getByRole('button', { name: 'Graft', exact: false })).toHaveCount(0)
})
