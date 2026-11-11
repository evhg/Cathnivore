import { expect, test } from '@playwright/test'

// Plan item 299: the /games/ backdrop is one fragment shader (Marrow's market square at dusk). A shader that fails
// to compile drops the page to its flat gradient without any visible error, so this checks it compiles and runs.
test('the market-square backdrop compiles and draws', async ({ page }) => {
  const shaderErrors: string[] = []
  page.on('console', (m) => {
    if ((m.type() === 'warning' || m.type() === 'error') && /ERROR: \d+:\d+/.test(m.text())) shaderErrors.push(m.text())
  })
  await page.goto('/games/')
  const hasGl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
  test.skip(!hasGl, 'no WebGL2 in this browser')
  await page.waitForTimeout(1500)
  expect(shaderErrors).toEqual([])
  await expect(page.locator('html')).not.toHaveClass(/no-webgl/)
  await expect(page.locator('#scene')).toBeVisible()
})
