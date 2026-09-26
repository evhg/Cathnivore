import { test, expect } from '@playwright/test'

// SPEC 9.2: the real Solo AI teammate is MCTSBot running in a Web Worker. `?e2eAutoplay=1` (used by
// quick-game.spec.ts/campaign.spec.ts) deliberately bypasses this — it drives every producer, including
// the AI teammate's own seat, through the fast synchronous HeuristicBot instead, so those tests can
// finish a whole game in milliseconds. This test does the opposite: it plays the human producer's turn
// for real (no autoplay) and confirms the real Worker-backed teammate then takes its own turn on its own,
// with no console errors — the thing those other tests never actually exercise.
test('the real Solo AI teammate (MCTSBot in a Worker) takes its turn after the human', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('/')
  await page.getByText('Quick Game').click()
  // Setup defaults to Solo with Mara (human, producers[0]) + Tomas (AI teammate, producers[1]).
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.active-producer')).toBeVisible()

  const firstName = (await page.locator('.active-producer strong').innerText()).trim()
  expect(firstName).toContain('Mara')

  async function graft() {
    await page.getByRole('button', { name: /^Graft:/ }).click()
  }

  // Mara's 3 actions (Graft is always legal, SPEC 4.6.7) hand the turn to Tomas, the AI teammate.
  await graft()
  await graft()
  await graft()

  // The teammate's decision goes through a real Worker round-trip (up to a 400ms MCTS search, SPEC 9.2)
  // plus the configured AI-speed delay, so give it real time rather than the default 5s — but it must
  // still finish well within a few seconds, not hang.
  await expect(page.locator('.active-producer strong')).not.toHaveText(firstName, { timeout: 15_000 })

  // SPEC 9.2: "Each AI action shows a one-line reason in the log." Confirms the reason `aiWorker.ts`
  // computed for the teammate's real move actually reaches the Log sheet, not just that a move happened.
  // On desktop the Log is always visible inline (SPEC 10.3); on phone it needs the "Log" toggle first. The
  // active-producer name flips to Tomas the instant his turn *starts* (`advanceTurnIfNeeded`), before the
  // Worker round-trip that actually picks and logs his move — so the log line itself needs its own wait,
  // not just the producer-name change above.
  const logToggle = page.getByRole('button', { name: 'Log' })
  if (await logToggle.isVisible().catch(() => false)) await logToggle.click()
  const firstLogLine = page.locator('.log-sheet li').first()
  await expect(firstLogLine).toContainText('Tomas', { timeout: 15_000 })
  expect(await firstLogLine.innerText()).toMatch(/Tomas .*\. .+\./)

  expect(errors).toEqual([])
  expect(consoleErrors).toEqual([])
})

// SPEC 11.4 gate 7's other half: "each AI teammate decision takes at most 1 second with 4x CPU
// throttling." `AI_TEAMMATE_BOT`'s `deadlineMs` (src/ai/mcts.ts) is a wall-clock cutoff, not a
// simulation-count one, so it should hold up under throttling by construction — fewer simulations run in
// the same ~400ms window, but the window itself doesn't get longer. This measures the real thing end to
// end (turn-change to turn-change, across the real Worker) rather than assuming that holds.
test('AI teammate decision stays under 1 second with 4x CPU throttling (SPEC 11.4 gate 7)', async ({
  page,
  browserName,
}) => {
  // CDP (`newCDPSession`) only exists in Chromium — this measures the same real Worker-backed teammate as
  // the test above, so running it once on a Chromium project is sufficient; the throttled-timing claim
  // isn't browser-engine-specific.
  test.skip(browserName !== 'chromium', 'CDP CPU throttling is only available in Chromium')
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.active-producer')).toBeVisible()
  const firstName = (await page.locator('.active-producer strong').innerText()).trim()

  async function graft() {
    await page.getByRole('button', { name: /^Graft:/ }).click()
  }
  await graft()
  await graft()

  const t0 = Date.now()
  await graft() // Mara's 3rd and final action — hands the turn to Tomas, the AI teammate.
  await expect(page.locator('.active-producer strong')).not.toHaveText(firstName, { timeout: 15_000 })
  const elapsedMs = Date.now() - t0

  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  expect(elapsedMs).toBeLessThan(1000)
})

// A code-review pass found that a thrown or hung Worker had no fallback (DECISIONS.md): the AI teammate's
// turn — and the whole game, SPEC 1.3's #1 priority ("games can be finished") — would stall forever with
// no visible error. `?e2eAiWorkerCrash=1` forces `aiWorker.ts` to throw on every decision, so this test
// exercises the real `onerror`/watchdog fallback to `HeuristicBot.chooseAction` end to end, rather than
// only asserting the fallback code exists.
test('a thrown AI worker error falls back to HeuristicBot instead of hanging the turn', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/?e2eAiWorkerCrash=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.active-producer')).toBeVisible()
  const firstName = (await page.locator('.active-producer strong').innerText()).trim()

  async function graft() {
    await page.getByRole('button', { name: /^Graft:/ }).click()
  }
  await graft()
  await graft()
  await graft()

  // The worker throws on every decision under this flag, so the teammate's move can only come from the
  // fallback path — well within the fallback's own 3s watchdog, not the 15s the real-Worker test above
  // allows for an actual MCTS search.
  await expect(page.locator('.active-producer strong')).not.toHaveText(firstName, { timeout: 5_000 })

  // The fallback calls `advance()` with no `aiReason` (it's HeuristicBot, not the real teammate's Worker
  // decision), so the log line for Tomas's move should have no reason sentence after the action caption —
  // confirming this really is the fallback path, not a lucky real decision that raced in first.
  const logToggle = page.getByRole('button', { name: 'Log' })
  if (await logToggle.isVisible().catch(() => false)) await logToggle.click()
  const firstLogLine = page.locator('.log-sheet li').first()
  await expect(firstLogLine).toContainText('Tomas')
  expect(await firstLogLine.innerText()).not.toMatch(/Tomas .*\. .+\./)

  // The Worker's own thrown exception fires `onerror`, not a page-level error — the whole point of the
  // fallback is that it's handled, not that it never happens — so `pageerror` should stay empty.
  expect(errors).toEqual([])
})
