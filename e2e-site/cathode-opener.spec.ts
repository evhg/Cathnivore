import { expect, test, type Page } from '@playwright/test'

// Plan item 192: a new case opens on the district opener ([data-cine="opener"]): letterbox bars and a typed card
// (district, hour, the name on The List) that runs 2.5-4.5 s while the HUD waits, then the HUD fades in. Escape
// skips it at once (under 300 ms, timed in the page) without opening the pause menu.
type Rec = { seen?: number; gone?: number; esc?: number; place?: string; target?: string; held?: boolean; after?: boolean; area?: boolean; hudHeld?: boolean; stall: number }
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
})

test('Escape skips the opener in under 300 ms and opens no pause menu', async ({ page, hasTouch }) => {
  test.setTimeout(400_000)
  await start(page, hasTouch, 500)
  const r = await page.evaluate(() => (window as unknown as W).rec)
  expect(r.esc).toBeDefined()
  expect(r.gone! - r.esc!).toBeLessThan(300)
  expect(r.after).toBe(false)
  expect(r.hudHeld).toBe(false)
  await expect(page.locator('#pause, .pause-card').filter({ visible: true })).toHaveCount(0)
})
