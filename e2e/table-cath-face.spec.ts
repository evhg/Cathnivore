import { expect, test } from '@playwright/test'

// Plan item 232: at 1440x900 Cath stands waist-up at the table's edge, her face 70 px or more across and covered by
// no card and not by her own bubble; over an autoplayed game her face takes three or more expressions.
test("Cath's face is readable at the table and follows the game at D", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop table')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    const seen = new Set<string>()
    ;(window as unknown as { __faces: Set<string> }).__faces = seen
    new MutationObserver(() => {
      const e = document.querySelector('.table-cath')?.getAttribute('data-expression')
      if (e) seen.add(e)
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-expression'] })
  })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.table-cath .cath-features').waitFor()
  await page.waitForTimeout(600)
  const m = await page.evaluate(() => {
    const face = document.querySelector('.table-cath .cath-features')!.getBoundingClientRect()
    const meets = (a: DOMRect) => a.left < face.right && face.left < a.right && a.top < face.bottom && face.top < a.bottom
    const covers = [...document.querySelectorAll('.table-cath-line, .hand-card, .action-card, .region-hex polygon, .table-producer')]
      .filter((e) => e.getClientRects().length)
      .map((e) => e.getBoundingClientRect())
      .filter(meets).length
    return { w: face.width, covers }
  })
  expect(m.w).toBeGreaterThanOrEqual(70)
  expect(m.covers).toBe(0)

  // The rest of the game plays itself; her face follows its events.
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 60_000 })
  const faces = await page.evaluate(() => [...(window as unknown as { __faces: Set<string> }).__faces])
  expect(faces.length, faces.join(',')).toBeGreaterThanOrEqual(3)
})
