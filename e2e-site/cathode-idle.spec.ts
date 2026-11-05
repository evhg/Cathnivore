import { expect, test } from '@playwright/test'

// Plan item 175: Cath alive on the front door. Standing still she breathes, shifts her weight, the umbrella sways in
// the wind, and she blinks every 3 to 5 s.

type Idle = { breath: number; weight: number; sway: number; blinks: number; blinking: boolean }
type W = { cathodeFront?: { ready: boolean; scene(): { idle: Idle; setTime(t: number): void } | null } }

test('her idle loop breathes, sways and blinks within 6 s of stepped time', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one viewport is enough: the idle loop is the same model')
  test.setTimeout(200_000)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto('/nightshift/?front=title&shot&t=1&quality=phone')
  await page.waitForFunction(() => (window as unknown as W).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const r = await page.evaluate(() => {
    const scene = (window as unknown as W).cathodeFront!.scene()!
    const seen: Idle[] = []
    for (let t = 1; t <= 7; t += 1 / 30) {
      scene.setTime(t)
      seen.push(scene.idle)
    }
    return seen
  })
  const span = (k: 'breath' | 'sway') => Math.max(...r.map((s) => s[k])) - Math.min(...r.map((s) => s[k]))
  expect(span('breath')).toBeGreaterThan(1) // a full breath in and out (0.25 Hz) inside 6 s
  expect(span('sway')).toBeGreaterThan(0.01)
  expect(r.some((s) => s.blinking), 'a frame with her eyes shut').toBe(true)
  expect(r.filter((s) => s.blinking).length, 'a blink, not a long close').toBeLessThan(r.length / 10)
  expect(r[r.length - 1]!.blinks).toBeGreaterThan(r[0]!.blinks)
})
