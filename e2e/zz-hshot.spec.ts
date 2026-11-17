import { test } from '@playwright/test'
for (const scheme of ['light', 'dark'] as const) {
  test('harvest mid-flight ' + scheme, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=2')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    const moment = page.locator('[data-moment="harvest"]')
    await moment.waitFor({ timeout: 90_000 })
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        const el = (a.effect as KeyframeEffect | null)?.target as Element | null
        if (el?.closest('.harvest-moment')) { a.pause(); a.currentTime = 650 }
      }
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/claude-0/-home-user-Cathnivore/9ecb6ea7-a93a-5abf-9e20-7da63a296b7d/scratchpad/h5/' + info.project.name + '-' + scheme + '.png' })
  })
}
