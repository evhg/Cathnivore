import { test, expect, type Page } from '@playwright/test'

// SPEC 11.6/STYLE.md 13: "5 portrait screenshots at the size Apple currently requires for the largest
// iPhone, each with a caption banner in Fraunces at the top." Only meant to run under the dedicated
// `store-screenshots` Playwright project (playwright.config.ts), which sets the 428x926 CSS
// viewport/deviceScaleFactor-3 combination that captures at Apple's required 1284x2778 physical pixels —
// run with `npx playwright test e2e/store-screenshots.spec.ts --project=store-screenshots`.
//
// The caption banner is store-listing decoration, not part of the game screen itself, so it's composited
// onto the live page with a small injected overlay rather than built into the app UI.
async function addCaptionBanner(page: Page, text: string): Promise<void> {
  await page.evaluate((caption) => {
    const banner = document.createElement('div')
    banner.textContent = caption
    Object.assign(banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '99999',
      background: 'var(--wheat)',
      color: 'var(--ink)',
      fontFamily: "'Fraunces', Georgia, serif",
      fontWeight: '700',
      fontSize: '34px',
      lineHeight: '1.25',
      textAlign: 'center',
      padding: '28px 24px',
      boxShadow: '0 2px 0 var(--ink)',
    })
    document.body.appendChild(banner)
  }, text)
}

test('1. mid-game map with the enemy plan visible', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.plan-strip')).toBeVisible()
  await addCaptionBanner(page, 'See their next move. Beat it.')
  await page.screenshot({ path: 'store/screenshots/1-enemy-plan.png' })
})

test('2. Cath\'s Plan with a witty scheme', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Cath’s Plan' }).click()
  // `.card-sheet` alone also matches the always-in-DOM (CSS-hidden below 1024px) desktop inline panels
  // for both Market and Cath's Plan; `.sheet.card-sheet` is the mobile overlay's own class combination.
  await expect(page.locator('.sheet.card-sheet')).toBeVisible()
  await addCaptionBanner(page, 'Her schemes. Your call.')
  await page.screenshot({ path: 'store/screenshots/2-cathsplan.png' })
})

test('3. a story scene', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await addCaptionBanner(page, 'A campaign with a twist. Or three.')
  await page.screenshot({ path: 'store/screenshots/3-story.png' })
})

test('4. an Agenda headline during the enemy turn', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByLabel('Hot-seat (two humans)').check()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.active-producer')).toBeVisible()
  // Spend all 6 actions of round 1 (3 per producer, Graft is always legal — SPEC 4.6.7) to trigger the
  // enemy turn. The playback's first caption is always the Agenda headline (enemy-turn events start from
  // the first 'agenda' log entry — see src/ui/enemyTurnLog.ts), so grabbing the shot right as the overlay
  // appears (before its 1s auto-advance) reliably catches it.
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /^Graft:/ }).click()
  }
  await expect(page.locator('.enemy-turn-playback')).toBeVisible()
  await addCaptionBanner(page, 'Big Food. Big Pharma. Small print.')
  await page.screenshot({ path: 'store/screenshots/4-agenda.png' })
})

test('5. a victory screen', async ({ page }) => {
  // Chapter 6 ("Kingsmarket") is the one campaign chapter whose win is actually about Kingsmarket, so it's
  // the only honest match for STYLE.md 13's exact caption. HeuristicBot only wins it ~63% of the time
  // (tests/chapters.test.ts, SPEC 9.4's >=50% floor) — not deterministic enough for a gate, but this test
  // isn't wired into scripts/gates.ts, so a retry on an occasional loss is an acceptable manual-asset cost.
  await page.goto('/?e2eAutoplay=1')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Kingsmarket/ }).click()
  await page.getByRole('button', { name: /^Solo/ }).click()
  await expect(page.locator('.scene')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.end-screen')).toContainText('You liberated Marrow.')
  await addCaptionBanner(page, 'Take back Kingsmarket.')
  await page.screenshot({ path: 'store/screenshots/5-victory.png' })
})
