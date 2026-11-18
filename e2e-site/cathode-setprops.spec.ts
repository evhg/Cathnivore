import { expect, test } from './own-gpu'

// Plan item 498: each class's set on the pick is dressed with props of its own (the stoop's one and three more);
// each class's set has its own, no prop is shared, and at D at least two of the dressing props stand in view (half of
// their box or more clear of the list and the sheet, or a third for the set-wide ones).
type Box = { name: string; left: number; top: number; right: number; bottom: number }
// Her carried weapon (the Ghost's slung rifle, the Butcher's shotgun, the Gunslinger's revolver) stays off her head and
// hood: no vertex inside its projected box and 6 px of air at least (the rifle's barrel stood on the hood's edge).
type Slung = { inHood: number; gap: number } | null
type F = { cathodeFront?: { ready: boolean; scene: () => { setPropBoxes(): Box[]; slungBox(): Slung } | null } }

test('each class pick set shows props of its own, in view', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop class pick')
  test.setTimeout(600_000)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  const canvas = page.locator('canvas[data-class]')
  const seen = new Map<string, string>()
  const classes = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']
  for (const cls of classes) {
    // (the still pick is staged per class: its keys move the list, not the 3D set)
    await page.goto(`/nightshift/?front=classpick&shot&t=8&class=${cls}&rs=0.5`)
    await page.waitForFunction(() => (window as unknown as F).cathodeFront?.ready === true, null, { timeout: 150_000 })
    await expect(canvas).toHaveAttribute('data-class', cls)
    const names = ((await canvas.getAttribute('data-set-props')) ?? '').split(' ').filter(Boolean)
    expect(names.length, cls).toBeGreaterThanOrEqual(4)
    for (const n of names) {
      expect(seen.get(n), `${n} on ${cls}`).toBeUndefined()
      seen.set(n, cls)
    }
    const inView = await page.evaluate(() => {
      const covers = ['.cp .cp-left', '.cp .cp-sheet']
        .map((q) => document.querySelector(q)?.getBoundingClientRect())
        .filter((r): r is DOMRect => !!r && r.width > 0)
      return (window as unknown as F).cathodeFront!.scene()!.setPropBoxes().map((b) => {
        let n = 0, vis = 0
        for (let i = 0; i < 20; i++)
          for (let j = 0; j < 20; j++) {
            const x = b.left + ((i + 0.5) / 20) * (b.right - b.left)
            const y = b.top + ((j + 0.5) / 20) * (b.bottom - b.top)
            n++
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
            if (covers.some((c) => x >= c.left && x <= c.right && y >= c.top && y <= c.bottom)) continue
            vis++
          }
        const wide = b.right - b.left > innerWidth * 0.6
        return { name: b.name, share: vis / n, ok: vis / n >= (wide ? 0.25 : 0.4) }
      })
    })
    expect(inView.filter((p) => p.ok).length, `${cls} ${JSON.stringify(inView)}`).toBeGreaterThanOrEqual(2)
    const slung = await page.evaluate(() => (window as unknown as F).cathodeFront!.scene()!.slungBox())
    if (slung) {
      expect(slung.inHood, `${cls} ${JSON.stringify(slung)}`).toBe(0)
      expect(slung.gap, `${cls} ${JSON.stringify(slung)}`).toBeGreaterThanOrEqual(6)
    }
  }
})
