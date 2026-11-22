import { expect, test } from './own-gpu'

// Plan item 639: the market's first frame is an arrival. The camera pushes in onto her eye before she has control,
// the weapon rests low until her first input, and the first mark stands in the street (a world-space diamond), on
// screen from the start.

type V3 = { x: number; y: number; z: number; clone(): V3; setY(y: number): V3; project(c: unknown): V3 }
type C = {
  stats: { frames: number }
  job?: { stage: number; mark: { group: { position: V3 } } | null }
  player: { pos: V3 }
  world: { camera: { position: V3 } }
  input: { forced: Record<string, boolean> }
  arsenal: { lowered: boolean }
}

test('the street opens on a push in, the weapon low and the first mark in view', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one layout is enough')
  test.setTimeout(400_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?play&class=ghost&rs=0.5&arrival')
  await page.waitForFunction(() => {
    const c = (window as unknown as { cathode?: C }).cathode
    return !!c?.job && c.stats.frames >= 2
  }, null, { timeout: 200_000 })
  const start = await page.evaluate(() => {
    const c = (window as unknown as { cathode: C }).cathode
    const cam = c.world.camera.position
    const mark = c.job!.mark!.group.position.clone()
    const ndc = mark.setY(mark.y + 1.5).project(c.world.camera)
    return { stage: c.job!.stage, lowered: c.arsenal.lowered, back: Math.hypot(cam.x - c.player.pos.x, cam.z - c.player.pos.z), ndc: { x: ndc.x, y: ndc.y, z: ndc.z } }
  })
  expect(start.stage).toBe(0)
  expect(start.lowered).toBe(true)
  // the push in starts 2.6 m behind her eye
  expect(start.back).toBeGreaterThan(0.5)
  expect(Math.abs(start.ndc.x)).toBeLessThan(0.9)
  expect(Math.abs(start.ndc.y)).toBeLessThan(0.9)
  expect(start.ndc.z).toBeLessThan(1)
  // it lands on her eye, the weapon still low; then her first input brings it up
  await page.waitForFunction(() => {
    const c = (window as unknown as { cathode: C }).cathode
    const cam = c.world.camera.position
    return Math.hypot(cam.x - c.player.pos.x, cam.z - c.player.pos.z) < 0.2
  }, null, { timeout: 200_000 })
  expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.arsenal.lowered)).toBe(true)
  await page.waitForFunction(() => {
    const c = (window as unknown as { cathode: C }).cathode
    c.input.forced = { reload: true }
    return !c.arsenal.lowered
  }, null, { timeout: 60_000, polling: 1000 })
})
