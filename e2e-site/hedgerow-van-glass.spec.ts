import { expect, test } from '@playwright/test'

// Plan item 757: from the field camera Hollowell's vans read as vans, not bricks: most on-screen vans and sprinters
// show their windscreen's sky-tinted glass (carried over the cab's roof edge so the camera sees it from above).
// Glass is counted as a pixel bluer than green and greener than red (the farm's greens have blue under green;
// Hollowell's purple has red over green), inside each van's own box where no neighbour covers its middle.
type Box = { kind: string; x: number; y: number; w: number; h: number }
type HG = {
  game(): { enemies: unknown[] }
  spawn(kind: string, dist: number): void
  freeze(): void
  camSettled(): boolean
  renderer(): { rungBoxes(): Box[] }
}

for (const size of [{ name: 'D', width: 1440, height: 900 }, { name: 'P', width: 390, height: 844 }])
  test(`level 27 ${size.name}: most 3D vans show windscreen glass`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: size.width, height: size.height })
    const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 27: true }, seen: {}, tips: t })), [stars, tips] as const)
    await page.goto('/hedgerow/?sandbox=1&level=27')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.camSettled()), { timeout: 90_000 }).toBe(true)
    await page.addStyleTag({ content: '#intro { display: none !important; }' })
    await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: HG }).hedgerow
      ;['van', 'sprinter', 'van', 'sprinter', 'van', 'sprinter', 'van', 'sprinter'].forEach((k, i) => h.spawn(k, 1.2 + i * 2.2))
      h.freeze()
    })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.renderer().rungBoxes().length), { timeout: 60_000 }).toBeGreaterThanOrEqual(6)
    await page.waitForTimeout(1500)
    const info = await page.evaluate(() => {
      const c = document.getElementById('canvas')!.getBoundingClientRect()
      const all = (window as unknown as { hedgerow: HG }).hedgerow.renderer().rungBoxes()
      const meet = (a: Omit<Box, 'kind'>, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
      const solo = all.filter((a) => a.x >= 0 && a.y >= 0 && a.x + a.w <= c.width && a.y + a.h <= c.height && all.every((b) => b === a || meet({ x: a.x + a.w / 4, y: a.y + a.h / 4, w: a.w / 2, h: a.h / 2 }, b) < a.w * a.h * 0.04))
      return { cx: c.x, cy: c.y, solo }
    })
    const png = await page.screenshot()
    const glass: Array<{ kind: string; share: number }> = await page.evaluate(async ({ b64, info }) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const cv = new OffscreenCanvas(img.width, img.height)
      const x = cv.getContext('2d')!
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, img.width, img.height).data
      const k = img.width / innerWidth
      return info.solo.map((b) => {
        const x0 = Math.round((info.cx + b.x) * k), x1 = Math.round((info.cx + b.x + b.w) * k)
        const y0 = Math.round((info.cy + b.y) * k), y1 = Math.round((info.cy + b.y + b.h) * k)
        let n = 0, tot = 0
        for (let y = y0; y < y1; y++)
          for (let xx = x0; xx < x1; xx++) {
            const o = (y * img.width + xx) * 4
            const r = d[o]!, g = d[o + 1]!, bl = d[o + 2]!
            tot++
            if (g > r + 12 && bl > g + 10 && bl > 70) n++
          }
        return { kind: b.kind, share: tot ? n / tot : 0 }
      })
    }, { b64: png.toString('base64'), info })
    const vans = glass.filter((g) => g.kind === 'van' || g.kind === 'sprinter')
    const msg = JSON.stringify(vans.map((v) => `${v.kind} ${(v.share * 100).toFixed(1)}%`))
    console.log(size.name, msg)
    expect(vans.length, msg).toBeGreaterThanOrEqual(3)
    expect(vans.filter((v) => v.share >= 0.01).length / vans.length, msg).toBeGreaterThan(0.5)
  })
