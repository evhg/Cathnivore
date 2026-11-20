import { expect, test, type Page } from '@playwright/test'

// Plan item 94: the 3D water is the 2D water's colour (sampled at a pond plot's middle, within ΔE 15).
// Item 399 gave each act its own water plot in 2D; Saltmarsh's is a salt pan (pink brine under a white crust, not open
// water), so the check samples Rivermead's willow pond (level 31), the first act whose water plot is open water.
// 2026-11-18: the pond on the field's middle rows, not water[0]. Level 31's first pond is on row 1, the 3D frame's far
// edge: under the deliberate far haze (scene fog and the CSS haze band), beside the gate queue and at a grazing angle,
// it read pale and moving (ΔE 14-19 by ripple and queue) while the near ponds matched 2D within ΔE 8-10. The colour
// was nudged four times chasing that sample (aa3e735, 13afa15, 3d3a54a); the check is the water's colour, not the haze.
// 2026-11-18: and not a cast shadow. Item 485's morning sun is low in the west, and Cath, standing west of that pond at
// the level's start, laid her 1.8x shadow across its middle (3D 17,72,83, a correct render). The check samples five
// spots across the pond (each a 9x9 median, so a glint or the lily pad can't decide it) and compares the most sunlit.
// (Now nine, and only the water-like ones: see pondColour.)
const LEVEL = 31
type HG = { game(): { level: { rows: number; terrain?: { water: Array<[number, number]> } } } | null; cellCenter(c: number, r: number): { x: number; y: number } | null }

async function pondColour(page: Page, mode: '2d' | '3d'): Promise<[number, number, number]> {
  const q = mode === '2d' ? '&2d' : ''
  await page.goto(`/hedgerow/?sandbox=1${q}`)
  await page.evaluate((LEVEL) => {
    const stars = Object.fromEntries(Array.from({ length: LEVEL - 1 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [LEVEL]: true }, tips: { all: true } }))
  }, LEVEL)
  await page.goto(`/hedgerow/?sandbox=1${q}&level=${LEVEL}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 120_000 })
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
  await page.waitForTimeout(mode === '3d' ? 12_000 : 1500)
  // The 3D camera eases in for longer than 12 s on a loaded machine; sampled mid-ease, the pond's middle read from a
  // moving frame. Sample it settled.
  if (mode === '3d') await page.waitForFunction(() => (window as unknown as { hedgerow: { camSettled(): boolean } }).hedgerow.camSettled(), null, { timeout: 180_000 })
  const spots = await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const lv = hg.game()!.level
    const mid = (lv.rows - 1) / 2
    const [c, r] = [...lv.terrain!.water].sort((a, b) => Math.abs(a[1] - mid) - Math.abs(b[1] - mid))[0]!
    const o = [-0.25, 0, 0.25]
    return o.flatMap((dr) => o.map((dc) => hg.cellCenter(c + dc, r + dr)))
  })
  expect(spots.every(Boolean)).toBe(true)
  // (three frames 1.2 s apart: the 3D water's colour breathes on a slow sine, so one frame sampled a random phase of it)
  const samples: Array<[number, number, number]> = []
  for (let k = 0; k < (mode === '3d' ? 3 : 1); k++) {
    if (k) await page.waitForTimeout(1200)
    const shot = await page.screenshot()
    samples.push(...(await Promise.all(spots.map((at) => median(page, shot, at!)))))
  }
  // 2026-11-18 (lane B): in 3D the pond stands a little above its cell's centre and its near bank carries reeds, so a
  // spot can land on the bank (3D 61,114,80 on CI: green, not water). Only water-like spots count (blue at least 0.9 of
  // green; reeds and grass are greener), then the most sunlit of them, as before.
  // 2026-11-20 (lane A): the median of them, not the most sunlit: the brightest water-like spot was a specular glint
  // (3D 121,171,158) or a ripple's crest, whichever phase the frame caught, so the check swung ΔE 12-19 run to run on
  // one build. The median is the water's own colour; a cast shadow over a few spots can't decide it either.
  const water = samples.filter(([, g, b]) => b >= g * 0.9)
  expect(water.length, `no water among ${JSON.stringify(samples)}`).toBeGreaterThan(0)
  return water.sort((a, b) => lab(b)[0] - lab(a)[0])[Math.floor(water.length / 2)]!
}

async function median(page: Page, shot: Buffer, at: { x: number; y: number }): Promise<[number, number, number]> {
  const png = shot.toString('base64')
  return page.evaluate(async ([b64, x0, y0]) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const x = c.getContext('2d')!
    x.drawImage(img, 0, 0)
    const d = x.getImageData(Math.round(x0) - 4, Math.round(y0) - 4, 9, 9).data
    const rs: number[] = [], gs: number[] = [], bs: number[] = []
    for (let i = 0; i < d.length; i += 4) { rs.push(d[i]!); gs.push(d[i + 1]!); bs.push(d[i + 2]!) }
    const med = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)]!
    return [med(rs), med(gs), med(bs)] as [number, number, number]
  }, [png, at.x, at.y] as const)
}

function lab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047)
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B)
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883)
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
}

test('the 3D pond is the 2D pond\'s colour', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one size is enough for a colour check')
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const flat = await pondColour(page, '2d')
  const deep = await pondColour(page, '3d')
  const [a, b] = [lab(flat), lab(deep)]
  const dE = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  expect(dE, `2D ${flat} vs 3D ${deep}`).toBeLessThanOrEqual(15)
})
