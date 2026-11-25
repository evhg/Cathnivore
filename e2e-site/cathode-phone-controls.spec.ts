import { expect, test } from './own-gpu'

// Plan item 686: on a phone held sideways the action keys are a thumb arc clear of the gun in her hand: with every
// key shown (the first job hides the ones it hasn't taught), none of them holds a viewmodel pixel; the weapon's name
// is a small tag under FIRE; her gloved hand has four fingers of three segments; and "Drag to aim" is gone 4 s after
// the first touch.

type C = {
  stats: { frames: number }
  job?: unknown
  input: { forced: Record<string, boolean>; firstTouchAt: number }
  arsenal: { lowered: boolean; anim: { dip: number }; arms: { right: { bones: { fingers: unknown[][] } } } }
  vmProbe(rects: { x: number; y: number; w: number; h: number }[]): { vmPx: number; inRects: number[] }
}

for (const [w, h] of [[844, 390], [932, 430]] as const) {
  test(`sideways phone ${w}x${h}: the thumb arc stays off the gun, the hint fades`, async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'the phone layout')
    test.setTimeout(400_000)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/nightshift/')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?play&class=ghost&rs=0.5')
    await page.waitForFunction(() => {
      const c = (window as unknown as { cathode?: C }).cathode
      return !!c?.job && c.stats.frames >= 2
    }, null, { timeout: 200_000 })
    await page.waitForFunction(() => {
      const c = (window as unknown as { cathode: C }).cathode
      c.input.forced = { reload: true }
      return !c.arsenal.lowered
    }, null, { timeout: 60_000, polling: 1000 })
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.arsenal.anim.dip < 0.05, null, { timeout: 60_000, polling: 500 })

    // The hint shows until the first touch, then goes within HINT_MS (4 s) plus a slow headless frame.
    await expect(page.locator('.look-hint')).not.toHaveClass(/gone/)
    await page.touchscreen.tap(120, h - 90)
    const t0 = Date.now()
    await page.waitForFunction(() => document.querySelector('.look-hint')?.classList.contains('gone'), null, { timeout: 8_000, polling: 100 })
    expect(Date.now() - t0).toBeGreaterThanOrEqual(3_500)

    const m = await page.evaluate(() => {
      const c = (window as unknown as { cathode: C }).cathode
      const keys = [...document.querySelectorAll<HTMLElement>('.tbtn[data-btn]')]
      for (const k of keys) {
        k.hidden = false
        k.classList.remove('idle')
        k.style.transition = 'none'
      }
      const rects = keys.map((k) => {
        const r = k.getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
      const tag = document.querySelector('.hud-weapon')!.getBoundingClientRect()
      const fire = document.querySelector('.tbtn-fire')!.getBoundingClientRect()
      const p = c.vmProbe(rects)
      return {
        vmPx: p.vmPx,
        keys: keys.map((k, i) => ({ k: k.dataset.btn, r: rects[i]!, vm: p.inRects[i]! })),
        tag: { x: tag.x, y: tag.y, w: tag.width, h: tag.height },
        fire: { x: fire.x, y: fire.y, w: fire.width, h: fire.height },
        fingers: c.arsenal.arms.right.bones.fingers.map((f) => f.length),
      }
    })
    expect(m.vmPx).toBeGreaterThan(1000)
    expect(m.keys.length).toBeGreaterThanOrEqual(6)
    for (const k of m.keys) {
      expect(k.r.w, k.k).toBeGreaterThan(0)
      expect(k.vm, JSON.stringify(k)).toBe(0)
    }
    // No two keys touch.
    for (let i = 0; i < m.keys.length; i++)
      for (let j = i + 1; j < m.keys.length; j++) {
        const a = m.keys[i]!.r, b = m.keys[j]!.r
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
        expect(apart, `${m.keys[i]!.k} / ${m.keys[j]!.k}`).toBe(true)
      }
    // The weapon tag sits under FIRE, inside the frame, at caption size.
    expect(m.tag.y).toBeGreaterThanOrEqual(m.fire.y + m.fire.h)
    expect(m.tag.y + m.tag.h).toBeLessThanOrEqual(h)
    expect(m.tag.h).toBeLessThanOrEqual(20)
    expect(m.tag.x + m.tag.w / 2).toBeGreaterThan(m.fire.x - 20)
    // Her glove: four fingers of three segments each.
    expect(m.fingers.length).toBe(4)
    for (const f of m.fingers) expect(f).toBeGreaterThanOrEqual(3)
  })
}
