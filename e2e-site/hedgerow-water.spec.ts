import { expect, test, type Page } from '@playwright/test'

// Plan item 94: the 3D water is the 2D water's colour (sampled at a pond plot's middle, within ΔE 15).
// Item 399 gave each act its own water plot in 2D; Saltmarsh's is a salt pan (pink brine under a white crust, not open
// water), so the check samples Rivermead's willow pond (level 31), the first act whose water plot is open water.
const LEVEL = 31
type HG = { game(): { level: { terrain?: { water: Array<[number, number]> } } } | null; cellCenter(c: number, r: number): { x: number; y: number } | null }

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
  const at = await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const lv = hg.game()!.level
    const mid = (lv.rows - 1) / 2
    const [c, r] = [...lv.terrain!.water].sort((a, b) => Math.abs(a[1] - mid) - Math.abs(b[1] - mid))[0]!
    return hg.cellCenter(c, r)
  })
  expect(at).not.toBeNull()
  const png = (await page.screenshot({ clip: { x: at!.x - 4, y: at!.y - 4, width: 9, height: 9 } })).toString('base64')
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const x = c.getContext('2d')!
    x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    const rs: number[] = [], gs: number[] = [], bs: number[] = []
    for (let i = 0; i < d.length; i += 4) { rs.push(d[i]!); gs.push(d[i + 1]!); bs.push(d[i + 2]!) }
    const med = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)]!
    return [med(rs), med(gs), med(bs)] as [number, number, number]
  }, png)
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
