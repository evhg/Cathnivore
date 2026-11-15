import { expect, test } from '@playwright/test'

// Plan item 410: in 3D Hollowell's queued fleet and depot read as its glossy plastic against the hand-made farm:
// each queued vehicle big enough to read as a car or van (28x16 px at 1440x900, 20x12 on a phone), the fleet's and
// the depot's main surfaces glossy (roughness 0.3 or less) where the farm's are matte (0.6 or more), and the first
// vehicle to pull out names itself, clear of the queue, as in 2D.
type Box = { x: number; y: number; w: number; h: number }
type HG = {
  game(): unknown
  camSettled(): boolean
  gateQueue(): { leads: Box[]; plates: Box[]; names: Box[]; boxes: Box[] } | null
  materialLook(): { queue: number[]; depots: number[]; farm: number } | null
}
const meet = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

for (const level of [21, 34]) {
  test(`the 3D fleet is glossy, readable and named at the gate (level ${level})`, async ({ page, hasTouch }) => {
    test.setTimeout(150_000)
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { [String(l)]: true }, seen: {}, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.camSettled()), { timeout: 60_000 }).toBe(true)
    await expect(page.locator('.queue-name').first()).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(600)
    const r = await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: HG }).hedgerow
      const c = document.getElementById('canvas')!.getBoundingClientRect()
      return { q: h.gateQueue()!, look: h.materialLook()!, w: c.width, h: c.height, name: document.querySelector('.queue-name')?.textContent ?? '' }
    })
    const [mw, mh] = hasTouch ? [20, 12] : [28, 16]
    const inFrame = r.q.boxes.filter((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= r.w && b.y + b.h <= r.h)
    expect(inFrame.length).toBeGreaterThan(0)
    for (const b of inFrame) {
      expect(Math.max(b.w, b.h), JSON.stringify(b)).toBeGreaterThanOrEqual(mw)
      expect(Math.min(b.w, b.h), JSON.stringify(b)).toBeGreaterThanOrEqual(mh)
    }
    for (const v of r.look.queue) expect(v, JSON.stringify(r.look)).toBeLessThanOrEqual(0.3)
    expect(r.look.depots.length).toBeGreaterThan(0)
    for (const v of r.look.depots) expect(v).toBeLessThanOrEqual(0.3)
    expect(r.look.farm).toBeGreaterThanOrEqual(0.6)
    expect(r.name.trim().length).toBeGreaterThan(2)
    for (const n of r.q.names) for (const l of r.q.leads) expect(meet(n, l), `name ${JSON.stringify(n)} on ${JSON.stringify(l)}`).toBe(0)
  })
}
