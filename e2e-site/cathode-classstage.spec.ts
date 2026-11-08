import { expect, test, type Page } from './own-gpu'

// Plan item 161: the class pick puts Cath on its stage. At D her figure stands 300 px or taller between the list and
// the sheet, meeting neither; keys 1 to 5 change the stage's data-class within 650 ms, each with a rim-light flash;
// the picker's labels are 12 px or more.
type Box = { left: number; top: number; right: number; bottom: number }
type F = { cathodeFront?: { ready: boolean; scene: () => { figureBox(body?: boolean): Box } | null } }

async function open(page: Page) {
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  await page.waitForFunction(() => (window as unknown as F).cathodeFront?.ready === true, null, { timeout: 150_000 })
}

test('Cath stands on the class pick stage, and keys 1-5 switch her class with a flash', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop class pick')
  test.setTimeout(240_000)
  await open(page)
  const m = await page.evaluate(() => {
    const b = (s: string) => {
      const r = document.querySelector(s)!.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
    const fig = (window as unknown as F).cathodeFront!.scene()!.figureBox(true)
    const labels = [...document.querySelectorAll('.cp-opt-name, .cp-opt-n, .cp-label, .cp-hold-how')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => parseFloat(getComputedStyle(e).fontSize))
    return { fig, list: b('.cp-left'), sheet: b('.cp-sheet'), minLabel: Math.min(...labels), h: innerHeight }
  })
  const s = JSON.stringify(m)
  expect(Math.min(m.fig.bottom, m.h) - Math.max(m.fig.top, 0), s).toBeGreaterThanOrEqual(300)
  for (const o of [m.list, m.sheet]) expect(m.fig.left < o.right && m.fig.right > o.left, s).toBe(false)
  expect(m.minLabel, s).toBeGreaterThanOrEqual(12)
  const stage = page.locator('.cp')
  await expect(stage).toHaveAttribute('data-class', 'ghost')
  const classes = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']
  for (const k of [2, 3, 4, 5, 1]) {
    const t0 = Date.now()
    await page.keyboard.press(String(k))
    await expect(stage).toHaveAttribute('data-class', classes[k - 1]!, { timeout: 650 })
    expect(Date.now() - t0).toBeLessThanOrEqual(650)
    await expect(stage).toHaveClass(/cp-swap/)
  }
})
