import { test, expect } from '@playwright/test'

// Plan item 144: the week's market event dresses the board. The map carries data-event, and every region shows the
// event's dressing (produce heaped for the Great Glut, lanterns for the Harvest Festival, cracked earth for the Dry
// Spell), none of it meeting a piece. The event comes from the ISO week, so each is reached by a date in its week.
for (const [event, day, sel, says] of [
  ['glut', '2026-11-05', '.ev-heap', 'Too many cabbages'],
  ['festival', '2026-11-10', '.ev-lanterns', 'Bunting up'],
  ['drought', '2026-11-17', '.ev-cracks', 'Not a cloud'],
] as const) {
  test(`the ${event} week dresses every region`, async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date(`${day}T10:00:00Z`))
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('svg.map')).toHaveAttribute('data-event', event)
    const regions = await page.locator('svg.map .region-hex').count()
    await expect(page.locator(`svg.map ${sel}`)).toHaveCount(regions)
    const hit = await page.evaluate((s) => {
      const pieces = [...document.querySelectorAll('.piece-tray .piece-slot')].map((e) => e.getBoundingClientRect())
      return [...document.querySelectorAll(s)].some((d) => {
        const a = d.getBoundingClientRect()
        return pieces.some((q) => q.left < a.right - 1 && a.left + 1 < q.right && q.top < a.bottom - 1 && a.top + 1 < q.bottom)
      })
    }, sel === '.ev-cracks' ? '.ev-none' : sel)
    expect(hit).toBe(false)
    // Cath opens the game on the week's event.
    await expect(page.locator('.table-cath-line, .cath-companion-line, .cath-dock-line').first()).toContainText(says)
    // Its ticket is pinned to the table (one line on a phone), its rule naming the cheaper kit, clear of every region.
    if (testInfo.project.name === 'desktop-chromium' || testInfo.project.name === 'phone') {
      await expect(page.locator('.event-ticket')).toBeVisible()
      await expect(page.locator('.event-ticket')).toContainText('1 Mark off')
      const overlap = await page.evaluate(() => {
        const t = document.querySelector('.event-ticket')!.getBoundingClientRect()
        const inside = (x: number, y: number, pts: DOMPoint[]) => {
          let c = false
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if (pts[i]!.y > y !== pts[j]!.y > y && x < ((pts[j]!.x - pts[i]!.x) * (y - pts[i]!.y)) / (pts[j]!.y - pts[i]!.y) + pts[i]!.x) c = !c
          return c
        }
        const hexes = [...document.querySelectorAll<SVGPolygonElement>('.region-hex > polygon:first-of-type')].map((pg) => [...pg.points].map((q) => new DOMPoint(q.x, q.y).matrixTransform(pg.getScreenCTM()!)))
        for (let x = t.left; x <= t.right; x += 4) for (let y = t.top; y <= t.bottom; y += 4) if (hexes.some((h) => inside(x, y, h))) return true
        return false
      })
      expect(overlap).toBe(false)
    }
  })
}

// Plan item 212: on an upright phone the market event's pennant hangs inside the board's frame, clear of
// Hollowell's plan cards above it.
test('the phone event pennant sits inside the frame, off the plan cards', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'an upright phone layout')
  await page.clock.setFixedTime(new Date('2026-11-05T10:00:00Z'))
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.event-ticket')).toBeVisible()
  const r = await page.evaluate(() => {
    const t = document.querySelector('.event-ticket')!.getBoundingClientRect()
    const strip = document.querySelector('.plan-strip')!.getBoundingClientRect()
    const wrap = document.querySelector('.map-wrap')!.getBoundingClientRect()
    return { gap: t.top - strip.bottom, inFrame: t.top >= wrap.top }
  })
  expect(r.gap).toBeGreaterThanOrEqual(0)
  expect(r.inFrame).toBe(true)
})
