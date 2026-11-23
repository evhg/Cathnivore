import { expect, test } from './own-gpu'

// Plan item 665: on a phone held sideways the weapon is in her hand: once her first input raises it (item 639 holds
// it low on arrival), the viewmodel sits in the frame's lower right at 5% or more of the frame, it is the weapon the
// HUD names, and a press of FIRE moves it within two frames.

type V3 = { x: number; y: number; project(c: unknown): V3 }
type Obj = { isMesh?: boolean; visible: boolean; position: { constructor: new () => V3 }; getWorldPosition(v: V3): V3; traverse(f: (o: Obj) => void): void; updateMatrixWorld(f: boolean): void }
type C = {
  stats: { frames: number }
  job?: unknown
  input: { forced: Record<string, boolean> }
  world: { viewCamera: unknown; renderer: { domElement: HTMLCanvasElement } }
  arsenal: { lowered: boolean; weapon: { id: string; name: string; kind: string }; rig: { root: Obj }; anim: { meleeT: number; dip: number } }
  vmProbe(): { vmPx: number }
}

test('sideways phone: her weapon is in hand, lower right, and answers FIRE', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the phone layout')
  test.setTimeout(400_000)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?play&class=ghost&rs=0.5')
  await page.waitForFunction(() => {
    const c = (window as unknown as { cathode?: C }).cathode
    return !!c?.job && c.stats.frames >= 2
  }, null, { timeout: 200_000 })
  // her first input raises it
  await page.waitForFunction(() => {
    const c = (window as unknown as { cathode: C }).cathode
    c.input.forced = { reload: true }
    return !c.arsenal.lowered
  }, null, { timeout: 60_000, polling: 1000 })
  await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.arsenal.anim.dip < 0.05, null, { timeout: 60_000, polling: 500 })
  const m = await page.evaluate(() => {
    const c = (window as unknown as { cathode: C }).cathode
    const root = c.arsenal.rig.root
    root.updateMatrixWorld(true)
    const pts: [number, number][] = []
    root.traverse((o) => {
      if (!o.isMesh || !o.visible) return
      const v = o.getWorldPosition(new o.position.constructor()).project(c.world.viewCamera)
      pts.push([v.x, v.y])
    })
    const cv = c.world.renderer.domElement
    const share = c.vmProbe().vmPx / (cv.width * cv.height)
    return {
      share,
      cx: pts.reduce((a, p) => a + p[0], 0) / pts.length,
      cy: pts.reduce((a, p) => a + p[1], 0) / pts.length,
      id: c.arsenal.weapon.id,
      name: c.arsenal.weapon.name,
      hud: document.querySelector('.hud-weapon')?.textContent ?? '',
    }
  })
  expect(m.share, JSON.stringify(m)).toBeGreaterThanOrEqual(0.05)
  expect(m.cx).toBeGreaterThan(0.1)
  expect(m.cy).toBeLessThan(0)
  // a fresh Ghost's first job: the Pin, and the HUD names it
  expect(m.id).toBe('pin')
  expect(m.hud.toUpperCase()).toContain(m.name.toUpperCase())
  // FIRE: the swing starts within two frames (counted in the page, frame by frame)
  const lag = await page.evaluate(() => new Promise<number>((done) => {
    const c = (window as unknown as { cathode: C }).cathode
    const f0 = c.stats.frames
    c.input.forced = { fire: true }
    const tick = () => {
      if (c.arsenal.anim.meleeT >= 0) return done(c.stats.frames - f0)
      if (c.stats.frames - f0 > 10) return done(99)
      requestAnimationFrame(tick)
    }
    tick()
  }))
  expect(lag).toBeLessThanOrEqual(2)
})
