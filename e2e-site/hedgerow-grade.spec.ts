import { expect, test } from '@playwright/test'

// Plan item 561: the 3D field's grade. A milky bloom lifted the whole field to one brightness, so the road loop the
// player defends didn't stand out. At 1440x900 on level 21 the lane (20 samples along it) differs from the plain
// plots beside it by 25% or more in mean luminance, and the canvas's top 120 px stay at 0.8 or under.
type HG = { game(): { level: { path: Array<[number, number]>; path2?: Array<[number, number]> } } | null; fieldShare(): number | null; camSettled(): boolean; plotLooks(): unknown[]; cellCenter(c: number, r: number): { x: number; y: number } | null }
test('the 3D lane reads as a band and the top of the frame is clear (level 21)', async ({ page }) => {
  const vp = page.viewportSize()!
  test.skip(vp.width < 1200, 'measured at 1440x900')
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 21; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '21': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game() && (window as unknown as { hedgerow: HG }).hedgerow.fieldShare() !== null, null, { timeout: 90_000 })
  await page.waitForFunction(() => (window as unknown as { hedgerow: HG }).hedgerow.camSettled(), null, { timeout: 90_000 }).catch(() => {})
  await page.waitForTimeout(5000)
  const shot = (await page.screenshot()).toString('base64')
  const r = await page.evaluate(async (src) => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const lv = hg.game()!.level
    const lane = new Set<string>()
    for (const path of [lv.path, lv.path2].filter(Boolean) as Array<Array<[number, number]>>)
      for (let i = 0; i + 1 < path.length; i++) {
        let [c, r] = path[i]!
        const [c1, r1] = path[i + 1]!
        while (c !== c1 || r !== r1) {
          lane.add(`${c},${r}`)
          c += Math.sign(c1 - c)
          r += Math.sign(r1 - r)
        }
        lane.add(`${c1},${r1}`)
      }
    const plots = new Set(hg.plotLooks().map((x) => String(Array.isArray(x) ? x[0] : x)))
    const img = new Image()
    img.src = `data:image/png;base64,${src}`
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = img.width
    cv.height = img.height
    const ctx = cv.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    const lum = (x: number, y: number) => {
      const d = ctx.getImageData(Math.round(x) - 2, Math.round(y) - 2, 5, 5).data
      let s = 0
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!)
      return s / (d.length / 4)
    }
    const inside = (q: { x: number; y: number } | null): q is { x: number; y: number } => !!q && q.x > 5 && q.y > 5 && q.x < img.width - 5 && q.y < img.height - 5
    const lanes: number[] = []
    const beside: number[] = []
    const cells = [...lane].map((k) => k.split(',').map(Number) as [number, number])
    const step = Math.max(1, Math.floor(cells.length / 20))
    for (let i = 0; i < cells.length && lanes.length < 20; i += step) {
      const [c, r] = cells[i]!
      const q = hg.cellCenter(c, r)
      if (!inside(q)) continue
      lanes.push(lum(q.x, q.y))
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = `${c + dc},${r + dr}`
        if (lane.has(k) || !plots.has(k)) continue
        const q2 = hg.cellCenter(c + dc, r + dr)
        if (inside(q2)) beside.push(lum(q2.x, q2.y))
      }
    }
    const rect = document.querySelector('#canvas')!.getBoundingClientRect()
    let top = 0
    let n = 0
    for (let y = rect.top + 2; y < rect.top + 120; y += 6)
      for (let x = rect.left + 3; x < rect.right; x += 12) {
        top += lum(x, y)
        n++
      }
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
    return { lanes: lanes.length, plots: beside.length, lane: mean(lanes), plot: mean(beside), top: top / n }
  }, shot)
  expect(r.lanes).toBeGreaterThanOrEqual(15)
  expect(r.plots).toBeGreaterThanOrEqual(10)
  expect(Math.abs(r.lane - r.plot) / Math.max(r.lane, r.plot), JSON.stringify(r)).toBeGreaterThanOrEqual(0.25)
  expect(r.top, JSON.stringify(r)).toBeLessThanOrEqual(0.8)
})
