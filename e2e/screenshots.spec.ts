import { test } from '@playwright/test'

// SPEC 11.4 gate 8: "capture screenshots of every screen at both sizes, plus one map screenshot in
// greyscale. A subagent reviews them against STYLE.md and section 10 and lists problems." This captures
// the screenshots (into e2e/screenshots/, gitignored — see .gitignore); the review itself is a separate
// step (done directly by the session, per DECISIONS.md, rather than as a literal subagent call every run).
test.describe.configure({ mode: 'serial' })

async function shoot(page: import('@playwright/test').Page, projectName: string, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${projectName}-${name}.png` })
}

test('title, setup, game, scene, end and rules screens', async ({ page }, testInfo) => {
  const project = testInfo.project.name

  await page.goto('/')
  await shoot(page, project, '1-title')

  await page.getByText('How to Play').click()
  await shoot(page, project, '2-rules-reference')
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByText('Quick Game').click()
  await shoot(page, project, '3-setup')
  await page.getByRole('button', { name: 'Start' }).click()

  await page.locator('.game').waitFor()
  await shoot(page, project, '4-game')

  // Greyscale map shot (SPEC 11.4 gate 8's "one map screenshot in greyscale," to check the map still
  // reads by shape/contrast alone, not just colour).
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addStyleTag({ content: 'html { filter: grayscale(100%); }' })
  await shoot(page, project, '5-map-greyscale')
  await page.addStyleTag({ content: 'html { filter: none; }' })

  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.end-screen').waitFor({ timeout: 30_000 })
  await shoot(page, project, '6-end-screen')

  await page.goto('/')
  await page.getByText('Campaign').click()
  await page.getByRole('button', { name: /Fresh Meat/ }).click()
  await page.locator('.scene').waitFor()
  await shoot(page, project, '7-scene')

  await page.goto('/')
  await page.getByText('Settings').click()
  await page.getByRole('heading', { name: 'Settings' }).waitFor()
  await shoot(page, project, '8-settings')

  await page.goto('/')
  await page.getByText('Credits').click()
  await page.getByRole('heading', { name: 'Credits' }).waitFor()
  await shoot(page, project, '9-credits')

  await page.goto('/')
  await page.getByText('Campaign').click()
  await page.getByRole('heading', { name: 'Campaign' }).waitFor()
  await shoot(page, project, '10-campaign')
})
