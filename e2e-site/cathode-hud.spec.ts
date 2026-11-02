import { expect, test, type Page } from '@playwright/test'

// Plan item 29: the HUD guides without clutter. The compass tape's objective tick sits at the objective's true
// bearing, the weapon block's round count drops when she fires, and Cath's subtitle never meets the central 30%
// of the screen (where the crosshair and the fight are) at D or L.

type V3 = { x: number; y: number; z: number }
type C = {
  stats: { frames: number }
  job?: unknown
  player: { pos: V3; yaw: number }
  objective(): V3 | null
  input: { forced: Record<string, boolean> }
  hud: { subtitle(t: string): void }
  arsenal: { busy: boolean; owned: Set<string>; equipId(id: string): void; weapon: { id: string } }
}


async function boot(page: Page, size = { width: 844, height: 390 }): Promise<void> {
  await page.setViewportSize(size)
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?play&class=gunslinger&rs=0.5')
  await page.waitForFunction(() => {
    const c = (window as unknown as { cathode?: C }).cathode
    return !!c?.job && c.stats.frames >= 3
  }, null, { timeout: 200_000 })
}

test.describe('NIGHT SHIFT HUD (plan item 29)', () => {
  test('the compass tick sits within 5 degrees of the objective\'s bearing', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough')
    test.setTimeout(400_000)
    await boot(page)
    // Face a few ways: each time, the tick on the tape matches the bearing worked out from the world.
    for (const turn of [0, 0.5, -0.7]) {
      const f0 = await page.evaluate((t) => {
        const c = (window as unknown as { cathode: C }).cathode
        c.player.yaw += t
        return c.stats.frames
      }, turn)
      await page.waitForFunction((f) => (window as unknown as { cathode: C }).cathode.stats.frames >= f + 2, f0, { timeout: 60_000 })
      const r = await page.evaluate(() => {
        const c = (window as unknown as { cathode: C }).cathode
        const o = c.objective()
        const tick = document.querySelector<HTMLElement>('.hud-compass-tick:not(.lt)')
        if (!o || !tick || tick.hidden) return null
        const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
        const rel = wrap(Math.atan2(o.x - c.player.pos.x, -(o.z - c.player.pos.z)) + c.player.yaw)
        return { rel, x: Number(tick.dataset.x), behind: tick.classList.contains('behind') }
      })
      expect(r).not.toBeNull()
      const span = Math.PI / 3
      if (Math.abs(r!.rel) > span) {
        // Behind the tape's span: pinned to the end on her side of it.
        expect(r!.behind).toBe(true)
        expect(r!.x).toBe(Math.sign(r!.rel))
      } else {
        expect(r!.behind).toBe(false)
        expect(Math.abs(r!.x * span - r!.rel) * (180 / Math.PI)).toBeLessThanOrEqual(5)
      }
    }
  })

  test('the round count drops when she fires', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough')
    test.setTimeout(400_000)
    await boot(page)
    await page.evaluate(() => {
      const c = (window as unknown as { cathode: C }).cathode
      c.arsenal.owned.add('kestrel')
      c.arsenal.equipId('kestrel')
    })
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.arsenal.weapon.id === 'kestrel' && !(window as unknown as { cathode: C }).cathode.arsenal.busy, null, { timeout: 200_000 })
    const mag = page.locator('.hud-mag')
    await expect(mag).toBeVisible()
    await expect(mag).toHaveText(/^\d+$/)
    const before = Number(await mag.textContent())
    expect(before).toBeGreaterThan(0)
    await page.evaluate(() => ((window as unknown as { cathode: C }).cathode.input.forced = { fire: true }))
    await expect.poll(async () => Number(await mag.textContent()), { timeout: 60_000 }).toBeLessThan(before)
  })

  test('Cath\'s subtitle stays clear of the central 30% at L and D', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough')
    test.setTimeout(400_000)
    await boot(page)
    const line = 'Cath: Somebody in this market knows where the Widowmaker went, and before the rain stops he is going to tell me all of it.'
    for (const size of [{ width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size)
      await page.evaluate((t) => (window as unknown as { cathode: C }).cathode.hud.subtitle(t), line)
      await expect(page.locator('.hud-sub.on')).toHaveCount(1)
      const r = await page.evaluate(() => {
        const b = document.querySelector('.hud-sub')!.getBoundingClientRect()
        const W = innerWidth
        const H = innerHeight
        return { b: { l: b.left, r: b.right, t: b.top, btm: b.bottom }, c: { l: W * 0.35, r: W * 0.65, t: H * 0.35, btm: H * 0.65 } }
      })
      const meets = !(r.b.r < r.c.l || r.b.l > r.c.r || r.b.btm < r.c.t || r.b.t > r.c.btm)
      expect(meets, `${size.width}x${size.height}: subtitle ${JSON.stringify(r.b)} vs centre ${JSON.stringify(r.c)}`).toBe(false)
    }
  })
})
