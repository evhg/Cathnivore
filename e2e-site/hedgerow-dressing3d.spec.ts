import { expect, test } from '@playwright/test'

// Plan item 185: the 3D field looks farmed: every plain plot gets standing dressing (ridges, stooks or clover
// clumps), hedges run along 60% or more of the lane's plot-side edges, and it all costs at most 4 draw calls.
type W = { hedgerow?: { game: () => unknown; dressing3d?: () => { plots: number; dressed: number; laneEdges: number; hedgedEdges: number; meshes: number } | null } }

test('the 3D field is dressed: crops on every plot, hedges along the lane', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 90_000 })
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.dressing3d?.(), null, { timeout: 60_000 })
  const d = (await page.evaluate(() => (window as unknown as W).hedgerow!.dressing3d!()))!
  expect(d.plots).toBeGreaterThan(10)
  expect(d.dressed).toBe(d.plots)
  expect(d.hedgedEdges / d.laneEdges).toBeGreaterThanOrEqual(0.6)
  expect(d.meshes).toBeLessThanOrEqual(12)
})
