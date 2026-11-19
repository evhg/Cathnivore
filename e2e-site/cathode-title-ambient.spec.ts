import { expect, test } from './own-gpu'

// Plan item 510: the street behind her on the title is alive. A lit Hollowell shop across the street, a passer-by under
// an umbrella walking past it, a car's headlights sweeping the cobbles and the shop's stuttering OPEN tube: the canvas
// names its running movers in [data-ambient], and under reduced motion none runs.

type O = { visible: boolean; position: { x: number; z: number } }
type W = { cathodeFront?: { ready: boolean; scene(): { setTime(t: number): void; world: { scene: { getObjectByName(n: string): O | undefined } } } | null } }

const sizes = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]

for (const vp of sizes) {
  test(`at ${vp.width}x${vp.height} the title street has 3+ ambient movers that move`, async ({ page }) => {
    test.skip(test.info().project.name !== 'site-desktop', 'one project covers every size')
    test.setTimeout(300_000)
    await page.setViewportSize(vp)
    await page.goto('/nightshift/?shot')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
    await page.waitForFunction(() => (window as unknown as W).cathodeFront?.scene?.() != null, null, { timeout: 150_000 })
    const movers = (await page.locator('canvas#view').getAttribute('data-ambient')) ?? ''
    expect(movers.split(' ').filter(Boolean).length, movers).toBeGreaterThanOrEqual(3)
    const at = (t: number) =>
      page.evaluate((t) => {
        const s = (window as unknown as W).cathodeFront!.scene()!
        s.setTime(t)
        const o = (n: string) => s.world.scene.getObjectByName(n)!
        const p = o('front-passer')
        return { passer: p.visible ? p.position.x : null, sweep: o('front-sweep').visible }
      }, t)
    const a = await at(7.5), b = await at(8.5), c = await at(10.4)
    // The passer-by walks (on the street at 7.5 s and 8.5 s, a metre or more apart), the headlights cross at 10.4 s.
    expect(a.passer, JSON.stringify({ a, b })).not.toBeNull()
    expect(b.passer, JSON.stringify({ a, b })).not.toBeNull()
    expect(Math.abs(a.passer! - b.passer!), JSON.stringify({ a, b })).toBeGreaterThan(1)
    expect(c.sweep, JSON.stringify(c)).toBe(true)
  })
}

test('under reduced motion nothing on the title street moves', async ({ page }) => {
  test.skip(test.info().project.name !== 'site-desktop', 'one project is enough')
  test.setTimeout(300_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as W).cathodeFront?.scene?.() != null, null, { timeout: 150_000 })
  expect((await page.locator('canvas#view').getAttribute('data-ambient')) ?? '').toBe('')
  const seen = await page.evaluate(() => {
    const s = (window as unknown as W).cathodeFront!.scene()!
    const out: boolean[] = []
    for (const t of [7.5, 8.5, 10.4]) {
      s.setTime(t)
      out.push(s.world.scene.getObjectByName('front-passer')!.visible, s.world.scene.getObjectByName('front-sweep')!.visible)
    }
    return out
  })
  expect(seen.every((v) => !v), JSON.stringify(seen)).toBe(true)
})
