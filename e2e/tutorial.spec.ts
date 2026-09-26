import { test, expect } from '@playwright/test'

// SPEC 11.4 gate 5: "campaign chapter 1 is completed by following the tutorial prompts, with the test
// clicking the highlighted elements." Unlike e2e/campaign.spec.ts (which drives every chapter through
// `?e2eAutoplay=1`, bypassing tutorial gating entirely — see src/ui/Game.tsx), this test plays chapter 1
// for real, by hand, to exercise SPEC 8.1's "only the action being taught is enabled" gating directly:
// each step should hide every action except the one it names, and taking that action should advance to
// the next step on its own (no separate "Got it" tap needed — see Game.tsx's `act`).
test('campaign chapter 1 ("Fresh Meat") is completed by following the tutorial prompts, clicking only the highlighted elements', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  const actions = page.locator('.actions')
  const prompt = page.locator('.tutorial-prompt p')

  // Step 0: "Open a Stall here" — only Open Stall is offered, Graft (always otherwise legal) is not.
  await expect(prompt).toContainText('Open a Stall')
  await expect(actions.getByRole('button', { name: 'Graft', exact: false })).toHaveCount(0)
  await actions.getByRole('button', { name: /^Open Stall/ }).click()
  await page.locator('.region-hex', { hasText: 'Brindle Hills' }).click()

  // Step 1: "Supply and clear the Outlet" — only Supply is offered now.
  await expect(prompt).toContainText('Supply')
  await expect(actions.getByRole('button', { name: 'Graft', exact: false })).toHaveCount(0)
  await expect(actions.getByRole('button', { name: /^Open Stall/ })).toHaveCount(0)
  await actions.getByRole('button', { name: /^Supply/ }).click()

  // Step 2: "Highmoor borders Brindle Hills" is informational (not gated — see chapters.ts), so it needs
  // a manual "Got it" rather than an action click.
  await expect(prompt).toContainText('Highmoor')
  await page.getByRole('button', { name: 'Got it' }).click()

  // Step 3: "Graft always works" — only Graft is offered (its own "?" tooltip trigger sits alongside it,
  // not a second action).
  await expect(prompt).toContainText('Graft always works')
  const otherButtons = await actions.locator('button').allTextContents()
  expect(otherButtons.every((t) => t.startsWith('Graft') || t === '?')).toBe(true)
  await actions.getByRole('button', { name: /^Graft/ }).click()

  // Steps 4-5 are informational (no highlight): free play resumes, and they need a manual "Got it".
  await expect(prompt).toContainText('Scout slot')
  await page.getByRole('button', { name: 'Got it' }).click()
  await expect(prompt).toContainText('Clear every Outlet');
  await page.getByRole('button', { name: 'Got it' }).click()
  await expect(page.locator('.tutorial-prompt')).toHaveCount(0)

  // Free play now: Graft is legal again, proving the gate lifted.
  await expect(actions.getByRole('button', { name: /^Graft/ })).toBeVisible()

  expect(errors).toEqual([])
})

test('campaign chapter 2 ("Word of Mouth") is completed by following the tutorial prompts, clicking only the highlighted elements', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Word of Mouth/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  const actions = page.locator('.actions')
  const prompt = page.locator('.tutorial-prompt p')

  // Step 0: "Spend Goodwill to Rebut" — only Rebut is offered (Sol's home, Saltmarsh, starts with Doubt).
  await expect(prompt).toContainText('Rebut it')
  await expect(actions.getByRole('button', { name: 'Graft', exact: false })).toHaveCount(0)
  await actions.getByRole('button', { name: /^Rebut/ }).click()

  // Step 1: "Public Trust ... Keep an eye on it" is informational — manual "Got it".
  await expect(prompt).toContainText('Public Trust')
  await page.getByRole('button', { name: 'Got it' }).click()

  // Step 2: "On Air raises Trust or your Goodwill" — only the (free) role ability is offered.
  await expect(prompt).toContainText('On Air')
  const otherButtons = await actions.locator('button').allTextContents()
  expect(otherButtons.every((t) => t.startsWith('Role'))).toBe(true)
  await actions.getByRole('button', { name: /^Role/ }).first().click()

  // Step 3: "Liberate 2 of these 3 regions" is informational — manual "Got it", then free play resumes.
  await expect(prompt).toContainText('Liberate 2 of these 3 regions')
  await page.getByRole('button', { name: 'Got it' }).click()
  await expect(page.locator('.tutorial-prompt')).toHaveCount(0)
  await expect(actions.getByRole('button', { name: /^Graft/ })).toBeVisible()

  expect(errors).toEqual([])
})

// SPEC 8.1: "a '?' link to the rules reference" alongside every tutorial prompt.
test('the tutorial prompt\'s "?" opens the rules reference and returns to the same game on close', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.locator('.tutorial-prompt')).toBeVisible()
  await page.getByRole('button', { name: 'Open the rules reference' }).click()
  await expect(page.locator('.rules-reference')).toBeVisible()
  await expect(page.locator('.tutorial-prompt')).toHaveCount(0)

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.rules-reference')).toHaveCount(0)
  // Back on the same in-progress game (not reset to the title or a fresh chapter start): step 0's prompt
  // and the Open Stall gating are both still there, exactly as left.
  await expect(page.locator('.tutorial-prompt')).toContainText('Open a Stall')
  await expect(page.locator('.actions').getByRole('button', { name: 'Graft', exact: false })).toHaveCount(0)
})
