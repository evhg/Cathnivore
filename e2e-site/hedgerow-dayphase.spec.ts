// Plan item 485: the day passes over the field. The first round is morning, the last dusk: the stage carries the
// phase and the lamps, and a 200x100 sample of the 2D field shifts by 15+ dE between the two.
import { expect, test, type Page } from '@playwright/test'

const LEVEL = 21
type HG = { game(): { phase: string; wave: number; level: { cols: number; rows: number; waves: unknown[] } } | null; cellCenter(c: number, r: number): { x: number; y: number } | null }

async function open(page: Page): Promise<void> {
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate((L) => {
    const stars = Object.fromEntries(Array.from({ length: L - 1 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [L]: true }, tips: { all: true } }))
  }, LEVEL)
  await page.goto(`/hedgerow/?sandbox=1&2d&level=${LEVEL}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 120_000 })
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
}

/** Sets the round the field waits on (build phase), lets the light ease over, and returns the stage's phase. */
async function atRound(page: Page, which: 'first' | 'last'): Promise<{ phase: string; lamps: string }> {
  await page.evaluate((which) => {
    const g = (window as unknown as { hedgerow: HG }).hedgerow.game()!
    g.phase = 'build'
    g.wave = which === 'first' ? 0 : g.level.waves.length - 1
  }, which)
  await page.waitForTimeout(2000)
  return page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('#stage')!
    return { phase: s.dataset.dayPhase ?? '', lamps: s.dataset.lamps ?? '' }
  })
}

async function fieldMean(page: Page): Promise<[number, number, number]> {
  const at = await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const lv = hg.game()!.level
    return hg.cellCenter(Math.floor(lv.cols / 2), Math.floor(lv.rows / 2))
  })
  expect(at).not.toBeNull()
  const vw = page.viewportSize()!
  const w = Math.min(200, vw.width - 20)
  const x = Math.max(0, Math.min(vw.width - w, at!.x - w / 2))
  const png = (await page.screenshot({ clip: { x, y: at!.y - 50, width: w, height: 100 } })).toString('base64')
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
    let r = 0, g = 0, b = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]!; g += d[i + 1]!; b += d[i + 2]! }
    const n = d.length / 4
    return [r / n, g / n, b / n] as [number, number, number]
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

test('the day runs from morning to dusk across a level', async ({ page }) => {
  test.setTimeout(180_000)
  await open(page)
  const first = await atRound(page, 'first')
  expect(first).toEqual({ phase: '0.00', lamps: 'off' })
  const morning = lab(await fieldMean(page))
  const last = await atRound(page, 'last')
  expect(last).toEqual({ phase: '1.00', lamps: 'on' })
  const dusk = lab(await fieldMean(page))
  const dE = Math.hypot(morning[0] - dusk[0], morning[1] - dusk[1], morning[2] - dusk[2])
  console.log('dE morning to dusk', dE.toFixed(1))
  expect(dE).toBeGreaterThanOrEqual(15)
})

// The 3D field: the frame's painted horizon (the sky band over the field) runs from the act's morning to dusk, and
// the 3D renderer follows the same phase. Desktop only: headless WebGL is slow and the phone frame is the same code.
test('the 3D horizon warms from morning to dusk', async ({ page }, info) => {
  test.skip(info.project.name.includes('phone'), 'desktop only')
  test.setTimeout(240_000)
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate((L) => {
    const stars = Object.fromEntries(Array.from({ length: L - 1 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [L]: true }, tips: { all: true } }))
  }, LEVEL)
  await page.goto(`/hedgerow/?sandbox=1&level=${LEVEL}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 120_000 })
  const horizon = async (which: 'first' | 'last'): Promise<[number, number, number]> => {
    await page.evaluate((which) => {
      const g = (window as unknown as { hedgerow: HG }).hedgerow.game()!
      g.phase = 'build'
      g.wave = which === 'first' ? 0 : g.level.waves.length - 1
    }, which)
    // the light eases over 1.2 s of wall-clock time, a frame at a time (a few fps under SwiftShader)
    await page.waitForFunction((want) => document.querySelector<HTMLElement>('#stage')?.dataset.dayPhase === want, which === 'first' ? '0.00' : '1.00', { timeout: 60_000 })
    await page.waitForTimeout(6000)
    const hex = await page.evaluate(() => getComputedStyle(document.querySelector('#stage')!).getPropertyValue('--field-horizon').trim())
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
  }
  const morning = lab(await horizon('first'))
  const dusk = lab(await horizon('last'))
  const dE = Math.hypot(morning[0] - dusk[0], morning[1] - dusk[1], morning[2] - dusk[2])
  console.log('3D horizon dE morning to dusk', dE.toFixed(1))
  expect(dE).toBeGreaterThanOrEqual(15)
  // dusk is warmer: more red than blue
  expect(dusk[2]).toBeGreaterThan(morning[2])
})
