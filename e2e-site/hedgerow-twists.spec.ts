import { expect, test } from '@playwright/test'

// Plan item 152: twists you can see. When a flood level's river rises its plots go under (the stage carries
// data-twist-active="flood" and how many plots are flooded, and the 2D field draws them as water); a fog level's
// sea fret drifts over the field as a layer at more than 0.3 opacity. Dressing only: the rules don't change.
type W = { hedgerow?: { game: () => { wave: number; level: { setPieces?: Array<{ kind: string; wave?: number }> } } | null } }

test('a flood level floods its plots once the river rises', async ({ page }) => {
  await page.goto('/hedgerow/?2d&sandbox=1&level=34')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  const stage = page.locator('#stage')
  await expect(stage).not.toHaveAttribute('data-twist-active', /flood/)
  await page.evaluate(() => {
    const g = (window as unknown as W).hedgerow!.game()!
    g.wave = g.level.setPieces!.find((p) => p.kind === 'flood')!.wave!
  })
  await expect(stage).toHaveAttribute('data-twist-active', /\bflood\b/)
  expect(Number(await stage.getAttribute('data-flooded'))).toBeGreaterThanOrEqual(1)
  await expect(page.locator('#field-fog')).toHaveCount(0)
})

test('a fog level drifts a sea fret over the field', async ({ page }) => {
  await page.goto('/hedgerow/?2d&sandbox=1&level=16')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  await expect(page.locator('#stage')).toHaveAttribute('data-twist-active', /\bfog\b/)
  const fog = page.locator('#field-fog')
  await expect(fog).toBeAttached()
  expect(Number(await fog.evaluate((e) => getComputedStyle(e).opacity))).toBeGreaterThan(0.3)
  expect(await fog.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none')
})
