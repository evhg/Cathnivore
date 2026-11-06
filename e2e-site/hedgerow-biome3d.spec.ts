import { expect, test } from '@playwright/test'

// Plan item 198: Saltmarsh's 3D field is a saltmarsh (tidal flats, reeds, boats, the sea in close); other acts keep
// their farm scenery for now.
type W = { hedgerow?: { game: () => unknown; biome3d?: () => string | null } }

for (const [level, biome] of [[21, 'saltmarsh'], [34, 'rivermead'], [15, 'highmoor'], [55, 'shingle'], [5, 'farm']] as const) {
  test(`level ${level} in 3D is ${biome}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.biome3d?.(), null, { timeout: 90_000 })
    expect(await page.evaluate(() => (window as unknown as W).hedgerow!.biome3d!())).toBe(biome)
  })
}
