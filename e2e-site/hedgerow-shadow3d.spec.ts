import { expect, test, type Page } from '@playwright/test'

// Plan item 360: by day the 3D field is lit by a low warm key with cast shadows that read. The same view is shot with
// the sun's shadows on and off; the pixels the shadows darken are the shadowed strips, and their median luminance must
// be 0.8x or less of the same pixels lit, over a share of the field that shows (hedges, barns, the house, folk).
type W = { hedgerow?: { game: () => unknown; camSettled?: () => boolean; shadows3d?: (on: boolean) => boolean } }

async function canvasShot(page: Page): Promise<string> {
  const buf = await page.locator('canvas').first().screenshot({ timeout: 120_000 })
  return buf.toString('base64')
}

async function measure(page: Page, on: string, off: string): Promise<{ share: number; median: number }> {
  return page.evaluate(async ({ a, b }) => {
    const read = async (s: string) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob())
      const c = new OffscreenCanvas(img.width, img.height)
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      return x.getImageData(0, 0, img.width, img.height).data
    }
    const p = await read(a)
    const q = await read(b)
    const lum = (d: Uint8ClampedArray, i: number) => (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255
    const ratios: number[] = []
    let n = 0
    for (let i = 0; i < p.length; i += 4) {
      n++
      const lit = lum(q, i)
      if (lit < 0.08) continue
      const r = lum(p, i) / lit
      if (r < 0.92) ratios.push(r)
    }
    ratios.sort((u, v) => u - v)
    return { share: ratios.length / n, median: ratios[Math.floor(ratios.length / 2)] ?? 1 }
  }, { a: on, b: off })
}

for (const level of [21, 34]) {
  test(`level ${level}: cast shadows read at 0.8x or darker by day`, async ({ page }, info) => {
    test.skip(info.project.name !== 'site-desktop', 'measured at D')
    test.setTimeout(240_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: l - 1 }, (_, i) => [String(i + 1), 3])), seenBefore: { [l]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })), level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 90_000 })
    await page.waitForFunction(() => (window as unknown as W).hedgerow?.camSettled?.() ?? true, null, { timeout: 60_000 })
    await page.waitForTimeout(3000)
    const on = await canvasShot(page)
    expect(await page.evaluate(() => (window as unknown as W).hedgerow!.shadows3d!(false))).toBe(true)
    await page.waitForTimeout(3000)
    const off = await canvasShot(page)
    const m = await measure(page, on, off)
    console.log(`level ${level}: shadowed share ${(m.share * 100).toFixed(1)}%, median ${m.median.toFixed(3)}`)
    expect(m.share).toBeGreaterThan(0.03)
    expect(m.median).toBeLessThanOrEqual(0.8)
  })
}
