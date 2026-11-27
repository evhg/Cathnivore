import { expect, test } from './own-gpu'

// Plan item 727: no strand of her long hair goes through her coat. On the title (hood down, the hair over her
// shoulders and back) scene().hairInCoat() casts rays in to the coat's axis from outside it for every sheet and lock
// vertex above the belt (bar the collar opening, where the hair tucks in by design); across the title's loop, as the
// hair sways and her head turns, none sits more than 4 mm inside the coat. Before the fix up to 16 vertices sat
// 5-15 mm inside it at the shoulder slope, the critique's strands poking through the coat at her shoulders.

type H = { depth: number; count: number; verts: number; at: number[] | null }
type S = { setTime(t: number): void; hairInCoat(): H }
type W = { cathodeFront?: { ready: boolean; scene(): S } }

test('her hair stays outside her coat through the title loop', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one viewport is enough: the check is in her own frame, not on screen')
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot')
  await page.waitForFunction(() => (window as unknown as W).cathodeFront?.ready === true, null, { timeout: 150_000 })
  await page.waitForTimeout(2000)
  for (const t of [0, 4, 9, 13, 18, 22, 27]) {
    await page.evaluate((t) => (window as unknown as W).cathodeFront!.scene().setTime(t), t)
    await page.waitForTimeout(600)
    const h = await page.evaluate(() => (window as unknown as W).cathodeFront!.scene().hairInCoat())
    // The check reached the hair: thousands of its vertices sit over the coat.
    expect(h.verts, `t ${t}`).toBeGreaterThan(1000)
    expect(h.count, `t ${t} ${JSON.stringify(h)}`).toBe(0)
    expect(h.depth, `t ${t} ${JSON.stringify(h)}`).toBeLessThanOrEqual(0.004)
  }
})
