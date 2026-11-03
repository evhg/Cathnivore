import { expect, test } from '@playwright/test'

// Plan item 57: the Drowned Market has people on it (walkers under umbrellas, vendors at the stalls, people in the
// doorways, riders), and they scatter when shooting starts: duck, then run for the exits, away from the shooter.

type V3 = { x: number; y: number; z: number; clone(): V3; set(x: number, y: number, z: number): V3; project(c: unknown): V3; addScaledVector(v: V3, k: number): V3 }
type Person = { x: number; y: number; z: number; mood: string; role: string }
type C = {
  stats: { frames: number }
  player: { pos: { x: number; z: number } }
  world: {
    fx: { muzzle(pos: V3, dir: V3, size: number): void }
    camera: { position: V3; getWorldDirection(v: V3): V3 }
    street?: { snapshot(): Person[] }
  }
}

test.describe('NIGHT SHIFT street life (plan item 57)', () => {
  test('at D, a dozen people on screen at the market spawn; one shot and they move away from Cath', async ({ browser, hasTouch, baseURL }) => {
    test.skip(hasTouch, 'the desktop view (D)')
    test.setTimeout(400_000)
    const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/nightshift/?play&class=gunslinger&district=market&rs=0.5')
    await page.waitForFunction(() => ((window as unknown as { cathode?: C }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 240_000 })

    const census = () =>
      page.evaluate(() => {
        const c = (window as unknown as { cathode: C }).cathode
        const people = c.world.street?.snapshot() ?? []
        const cam = c.world.camera
        let onScreen = 0
        for (const s of people) {
          if (s.mood === 'gone') continue
          const v = cam.position.clone().set(s.x, s.y + 1.2, s.z).project(cam)
          if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) onScreen++
        }
        const near = people.filter((s) => Math.hypot(s.x - c.player.pos.x, s.z - c.player.pos.z) < 30)
        const mean = near.reduce((n, s) => n + Math.hypot(s.x - c.player.pos.x, s.z - c.player.pos.z), 0) / Math.max(1, near.length)
        return { onScreen, mean, near: near.length, scared: people.filter((s) => s.mood === 'duck' || s.mood === 'flee' || s.mood === 'gone').length }
      })

    const calm = await census()
    expect(calm.onScreen).toBeGreaterThanOrEqual(12)
    expect(calm.near).toBeGreaterThanOrEqual(8)
    expect(calm.scared).toBe(0)

    // One shot from where she stands (she starts with the baton, so it's fired as every gun fires: through the muzzle
    // flash, which is where the street hears it). Everyone in earshot ducks, then runs; within 3 s their mean distance
    // from her has risen.
    await page.evaluate(() => {
      const w = (window as unknown as { cathode: C }).cathode.world
      const dir = w.camera.getWorldDirection(w.camera.position.clone())
      w.fx.muzzle(w.camera.position.clone().addScaledVector(dir, 0.6), dir, 0.7)
    })
    const t0 = Date.now()
    await expect.poll(async () => (await census()).scared, { timeout: 10_000 }).toBeGreaterThanOrEqual(8)
    await page.waitForTimeout(Math.max(0, 3000 - (Date.now() - t0)))
    const after = await census()
    expect(after.mean).toBeGreaterThan(calm.mean)
    expect(errors).toEqual([])
    await ctx.close()
  })
})
