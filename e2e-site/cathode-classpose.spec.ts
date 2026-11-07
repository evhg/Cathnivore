import { expect, test } from '@playwright/test'

// Plan item 180: Cath posed as each class. On the class pick she keeps each class's signature pose once its audition
// is done (the stage's data-class drives scene().figurePose()); a change of class blends over 400 ms of the loop's
// time; her face reads (90 px+ tall at D, 70 at P) and her body meets neither the list nor the sheet at D.
type Box = { left: number; top: number; right: number; bottom: number }
type Pose = { kind: string | null; w: number; blendS: number; hand: [number, number, number] }
type S = { time: number; dressed: string | null; figurePose(): Pose; faceBox(): Box; figureBox(body?: boolean): Box }
type F = { cathodeFront?: { scene: () => S | null } }

const CLASSES = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']

test('each class holds its own pose on the pick, blended in 600 ms of loop time', async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  await page.setViewportSize(hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  const pose = () => page.evaluate(() => (window as unknown as F).cathodeFront?.scene()?.figurePose() ?? null)
  await expect.poll(async () => (await pose())?.kind ?? null, { timeout: 200_000 }).toBe('ghost')
  const hands: Record<string, Pose['hand']> = {}
  for (const cls of [...CLASSES.slice(1), 'ghost']) {
    // An upright phone picks by page dot (item 245 hid the names' row there).
    await page.locator(`${hasTouch ? '.cp-dot' : '.cp-opt'}[data-cls=${cls}]`).click()
    await expect(page.locator('.cp')).toHaveAttribute('data-class', cls)
    // Settled: the new class's stance at full weight. The blend's own length is measured on the loop's clock (headless
    // WebGL draws a few frames a second, so wall time says little).
    await expect.poll(async () => {
      const p = await pose()
      return p?.kind === cls && p.w === 1
    }, { timeout: 60_000 }).toBe(true)
    const blend = (await pose())!.blendS
    // Wait for the audition to end, so what's measured is the held stance, not the audition passing through.
    await page.waitForFunction(() => {
      const s = (window as unknown as F).cathodeFront!.scene()!
      return (s as unknown as { vignette: unknown }).vignette === null
    }, null, { timeout: 120_000 })
    const p = (await pose())!
    expect(p.kind).toBe(cls)
    hands[cls] = p.hand
    // The blend takes 400 ms of loop time (a long frame can overshoot a step; 600 ms is the line).
    expect(blend, cls).toBeGreaterThan(0)
    expect(blend, cls).toBeLessThanOrEqual(0.6)
    const m = await page.evaluate(() => {
      const s = (window as unknown as F).cathodeFront!.scene()!
      const b = (q: string) => {
        const e = document.querySelector(q)
        if (!e) return null
        const r = e.getBoundingClientRect()
        return r.width ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null
      }
      return { face: s.faceBox(), body: s.figureBox(true), list: b('.cp-left'), sheet: b('.cp-sheet') }
    })
    const msg = JSON.stringify(m)
    expect(m.face.bottom - m.face.top, msg).toBeGreaterThanOrEqual(hasTouch ? 70 : 90)
    if (!hasTouch) for (const o of [m.list, m.sheet]) if (o) expect(m.body.left < o.right && m.body.right > o.left, msg).toBe(false)
  }
  // A different pose per class: her posing hand in a different place for each (5 cm apart at least).
  const keys = Object.keys(hands)
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const a = hands[keys[i]!]!
      const b = hands[keys[j]!]!
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), JSON.stringify(hands)).toBeGreaterThan(0.05)
    }
})
