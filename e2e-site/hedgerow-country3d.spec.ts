import { expect, test } from '@playwright/test'

// Plan item 419: each act's 3D field stands in its own country. Past the hedge the land wears the act's country
// grounds (under 5% of it still the field's plain grass, within 10 of it in every channel), with 12 or more props.
test('every act sets its 3D field in its own country', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one check of the ground per act is enough')
  test.setTimeout(600_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const out: string[] = []
  for (const id of [1, 11, 21, 31, 41, 51, 61, 71, 81, 91]) {
    await page.addInitScript((l) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { [l]: true }, tips: {} })), id)
    await page.goto(`/hedgerow/?sandbox=1&level=${id}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { margin3d: () => unknown } }).hedgerow?.margin3d(), null, { timeout: 120_000 })
    const m = (await page.evaluate(() => (window as unknown as { hedgerow: { margin3d: () => { plainShare: number; props: number } } }).hedgerow.margin3d()))!
    out.push(`${id}: ${m.plainShare.toFixed(3)} plain, ${m.props} props`)
    expect(m.plainShare, out.join('; ')).toBeLessThan(0.05)
    expect(m.props, out.join('; ')).toBeGreaterThanOrEqual(12)
  }
  console.log(out.join('\n'))
})
