import { test, expect } from '@playwright/test'

// Plan item 121 sized the map's SQUEEZE/EXPAND tags; plan item 550 replaces them: Hollowell's next targets are each
// hex's lit rim (clay for a Squeeze, Hollowell's orange for an Expand), named for screen readers, and no tag sits over the art.
test('Hollowell\'s targets light their hexes\' rims, with no tag over the board', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()
  const edges = page.locator('.region-hex .threat-edge')
  await expect(edges.first()).toBeAttached({ timeout: 10_000 })
  const m = await edges.evaluateAll((els) =>
    els.map((e) => {
      const line = e.querySelectorAll('polygon')[1]!.getBoundingClientRect()
      const hex = e.closest('.region-hex')!.querySelector('polygon')!.getBoundingClientRect()
      return { kind: e.getAttribute('data-threat'), title: e.querySelector('title')?.textContent ?? '', w: line.width, hexW: hex.width }
    }),
  )
  expect(m.length).toBeGreaterThan(0)
  for (const e of m) {
    expect(['squeeze', 'expand']).toContain(e.kind)
    expect(e.title, JSON.stringify(e)).toMatch(/Hollowell (squeezes|expands) here next/)
    // the rim runs round the whole hex
    expect(e.w, JSON.stringify(m)).toBeGreaterThan(e.hexW * 0.9)
  }
  await expect(page.locator('.region-hex .threat-badge')).toHaveCount(0)
})
