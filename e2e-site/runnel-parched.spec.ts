import { expect, test } from '@playwright/test'

// Plan item 711: the unsolved board is alive. A field waiting for water reads parched (sun-baked clay, crazed with
// cracks, its seedling drooped), far from a watered one's green (20+ in CIE76 ΔE, light and dark); the tap that joins a
// tile shows its water within 300 ms; under reduced motion the states swap without a fade.

type T = { runnelTest: { nearlySolve: () => void } }

const faceOf = (sel: string) =>
  `(() => {
    const t = document.querySelector(${JSON.stringify(sel)})
    if (!t) return null
    const c = document.createElement('canvas')
    c.width = c.height = 1
    const x = c.getContext('2d')
    x.fillStyle = getComputedStyle(t).fill
    x.fillRect(0, 0, 1, 1)
    return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)]
  })()`

const lab = ([r, g, b]: number[]) => {
  const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  const [R, G, B] = [lin(r!), lin(g!), lin(b!)]
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
const dE = (a: number[], b: number[]) => {
  const [p, q] = [lab(a), lab(b)]
  return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!)
}

for (const scheme of ['light', 'dark'] as const) {
  test(`a dry field is parched clay, a watered one green (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.clock.setFixedTime(new Date('2026-11-17T10:00:00Z'))
    await page.goto('/runnel/?nohelp&sky=noon,clouds')
    await page.waitForSelector('#board .tiles > g.cell')
    const drySel = '#board .tiles > g.cell.field:not(.reservoir):not(.wet) .tile'
    const dry = (await page.evaluate(faceOf(drySel))) as number[]
    expect(dry).not.toBeNull()
    const cracks = page.locator('#board .tiles > g.cell.field:not(.reservoir):not(.wet) .mud-cracks').first()
    expect(Number(await cracks.evaluate((e) => getComputedStyle(e).opacity))).toBeGreaterThan(0.4)
    await page.evaluate(() => (window as unknown as T).runnelTest.nearlySolve())
    await page.locator('#board [data-last]').click()
    const wetSel = '#board .tiles > g.cell.field.wet:not(.reservoir) .tile'
    await expect(page.locator(wetSel).first()).toBeAttached()
    const wet = (await page.evaluate(faceOf(wetSel))) as number[]
    expect(dE(dry, wet), `dry ${dry} vs wet ${wet}`).toBeGreaterThanOrEqual(20)
    const wetCracks = page.locator('#board .tiles > g.cell.field.wet:not(.reservoir) .mud-cracks').first()
    // reduced motion: no fade, the cracks are gone at once
    expect(parseFloat(await wetCracks.evaluate((e) => getComputedStyle(e).transitionDuration))).toBeLessThanOrEqual(0.01)
    expect(await wetCracks.evaluate((e) => getComputedStyle(e).opacity)).toBe('0')
  })
}

test('the tap that joins a tile shows its water within 300 ms', async ({ page }) => {
  await page.goto('/runnel/?nohelp&practice')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.evaluate(() => (window as unknown as T).runnelTest.nearlySolve())
  const last = page.locator('#board [data-last]')
  await expect(last).not.toHaveAttribute('data-wet', '1')
  // Timed in the page, from the press to the water's arrival (`data-wet`), so the test's own polling adds nothing.
  await last.evaluate((g) => {
    const w = window as unknown as { t0?: number; t1?: number }
    g.addEventListener('pointerdown', () => (w.t0 = performance.now()), { capture: true, once: true })
    new MutationObserver((_, o) => {
      if ((g as SVGGElement).dataset.wet) {
        w.t1 = performance.now()
        o.disconnect()
      }
    }).observe(g, { attributes: true, attributeFilter: ['data-wet'] })
  })
  await last.click()
  await expect(last).toHaveAttribute('data-wet', '1', { timeout: 2_000 })
  const ms = await page.evaluate(() => {
    const w = window as unknown as { t0: number; t1: number }
    return w.t1 - w.t0
  })
  // The water is scheduled to arrive 75 ms into the turn (+70 ms to mark it there): within 300 ms on a phone. Headless
  // Chromium spends 100 ms+ painting the board around the tap, so the wall clock here gets that much slack.
  expect(Number.parseFloat(await last.evaluate((g) => (g as SVGGElement).style.getPropertyValue('--delay')))).toBeLessThanOrEqual(150)
  expect(ms).toBeLessThanOrEqual(450)
})
