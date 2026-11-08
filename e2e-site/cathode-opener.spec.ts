import { expect, test, type Page } from './own-gpu'

// Plan item 192: a new case opens on the district opener ([data-cine="opener"]): letterbox bars and a typed card
// (district, hour, the name on The List) that runs 2.5-4.5 s while the HUD waits, then the HUD fades in. Escape
// skips it at once (under 300 ms, timed in the page) without opening the pause menu.
type Rec = { shotOn?: boolean; shotAfter?: boolean; seen?: number; gone?: number; esc?: number; place?: string; target?: string; held?: boolean; after?: boolean; area?: boolean; hudHeld?: boolean; stall: number }
type W = { rec: Rec; escAt?: number }

// Under SwiftShader a Playwright round trip takes seconds, so the page records everything itself: when the opener
// appears (its labels and whether the HUD waits), when it goes, and (escAt) sends Escape that long after it appears.
async function start(page: Page, touch: boolean, escAt?: number): Promise<void> {
  if (touch) await page.setViewportSize({ width: 844, height: 390 })
  await page.addInitScript((esc) => {
    const w = window as unknown as W
    w.rec = { stall: 0 }
    const root = () => document.documentElement
    // The longest gap between frames while the opener is up: a timer can't fire inside a stalled frame, so that
    // much over its schedule is the page's (software WebGL), not the opener's.
    let last = 0
    const frame = (t: number) => {
      if (w.rec.seen !== undefined && w.rec.gone === undefined && last) w.rec.stall = Math.max(w.rec.stall, t - last)
      // Item 192: whether the trailing shot ran.
      const op = (window as unknown as { cathode?: { opener?: () => { on: boolean; k: number; box: { top: number; bottom: number } | null } } }).cathode?.opener?.()
      if (op?.on) w.rec.shotOn = true
      last = t
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    new MutationObserver(() => {
      const el = document.querySelector('[data-cine="opener"]')
      if (el && w.rec.seen === undefined) {
        w.rec.seen = performance.now()
        w.rec.place = el.querySelector('.opener-place')?.getAttribute('aria-label') ?? ''
        w.rec.target = el.querySelector('.opener-target')?.getAttribute('aria-label') ?? ''
        w.rec.held = root().classList.contains('area-arriving')
        if (esc !== undefined)
          setTimeout(() => {
            w.rec.esc = performance.now()
            dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
          }, esc)
      }
      if (!el && w.rec.seen !== undefined && w.rec.gone === undefined) {
        w.rec.gone = performance.now()
        // The HUD class is lifted as the opener's promise settles: read it a task later.
        setTimeout(() => {
          w.rec.after = root().classList.contains('area-arriving')
          w.rec.area = !document.getElementById('area-title')!.hidden
          w.rec.hudHeld = !!document.querySelector('.hud-root.is-arriving')
          w.rec.shotAfter = (window as unknown as { cathode?: { opener?: () => { on: boolean } } }).cathode?.opener?.().on ?? false
        }, 0)
      }
    }).observe(document, { childList: true, subtree: true })
  }, escAt)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto('/nightshift/?play&opener&class=ghost&rs=0.5')
  await page.waitForFunction(() => (window as unknown as W).rec.after !== undefined, null, { timeout: 300_000 })
}

test('a new case opens on the district opener, then the HUD', async ({ page, hasTouch }) => {
  test.setTimeout(400_000)
  await start(page, hasTouch)
  const r = await page.evaluate(() => (window as unknown as W).rec)
  expect(r.place).toBe('THE FISH MARKET')
  expect(r.target).toMatch(/Julian Crisp/)
  // While it runs the HUD waits; then it comes in, with no area title on top.
  expect(r.held).toBe(true)
  const ran = r.gone! - r.seen!
  expect(ran).toBeGreaterThanOrEqual(2500)
  expect(ran).toBeLessThanOrEqual(4500 + r.stall)
  expect(r.after).toBe(false)
  expect(r.area).toBe(false)
  expect(r.hudHeld).toBe(false)
  // The lens trailed her, and after it the view is her eyes.
  expect(r.shotOn).toBe(true)
  expect(r.shotAfter).toBe(false)
})

test("the opener's lens frames Cath a quarter of the frame tall at its middle, then cuts to her eyes", async ({ page, hasTouch }) => {
  test.setTimeout(400_000)
  await start(page, hasTouch)
  // Under software WebGL a frame can take longer than the whole shot, so its middle is held for the measurement.
  type C = { cathode: { openerShot(ms: number, hold?: number): boolean; openerEnd(): void; opener(): { on: boolean; k: number; box: { top: number; bottom: number } | null }; stats: { frames: number } } }
  expect(await page.evaluate(() => (window as unknown as C).cathode.openerShot(2600, 0.5))).toBe(true)
  const f0 = await page.evaluate(() => (window as unknown as C).cathode.stats.frames)
  await page.waitForFunction((f) => (window as unknown as C).cathode.stats.frames >= f + 2, f0, { timeout: 120_000 })
  const mid = await page.evaluate(() => ({ ...(window as unknown as C).cathode.opener(), vh: innerHeight }))
  expect(mid.on).toBe(true)
  if (process.env.OPENER_SHOTS) await page.screenshot({ path: `${process.env.OPENER_SHOTS}/opener-mid-${hasTouch ? 'L' : 'D'}.png` })
  // Her box (crown to feet) as it shows inside the frame: a medium shot may cut her below the knee.
  const top = Math.max(0, mid.box!.top)
  const bottom = Math.min(mid.vh, mid.box!.bottom)
  expect((bottom - top) / mid.vh).toBeGreaterThanOrEqual(0.25)
  // Her head is in the frame's upper half.
  expect(mid.box!.top).toBeGreaterThanOrEqual(0)
  expect(mid.box!.top).toBeLessThan(mid.vh * 0.5)
  await page.evaluate(() => (window as unknown as C).cathode.openerEnd())
  expect(await page.evaluate(() => (window as unknown as C).cathode.opener().on)).toBe(false)
  if (process.env.OPENER_SHOTS) {
    await page.waitForFunction((f) => (window as unknown as C).cathode.stats.frames >= f + 3, f0 + 2, { timeout: 120_000 })
    await page.screenshot({ path: `${process.env.OPENER_SHOTS}/opener-after-${hasTouch ? 'L' : 'D'}.png` })
  }
})

test('Escape skips the opener in under 300 ms and opens no pause menu', async ({ page, hasTouch }) => {
  test.setTimeout(400_000)
  await start(page, hasTouch, 500)
  const r = await page.evaluate(() => (window as unknown as W).rec)
  expect(r.esc).toBeDefined()
  expect(r.gone! - r.esc!).toBeLessThan(300)
  expect(r.after).toBe(false)
  expect(r.hudHeld).toBe(false)
  // A skip cuts straight to her eyes.
  expect(r.shotAfter).toBe(false)
  await expect(page.locator('#pause, .pause-card').filter({ visible: true })).toHaveCount(0)
})
