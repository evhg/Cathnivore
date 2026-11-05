import { expect, test } from '@playwright/test'

// Plan item 177: the bugs from the 2026-11-05 18:30 critique (Hedgerow's share). The lane turning down at a row's end
// and leaving an act under its last stop ran across that stop's name ('Brand Ambassador' on the path).

/** Samples along each act's lane that fall inside a stop's name plate, by name. */
async function laneOverNames(page: import('@playwright/test').Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const out: Record<string, number> = {}
    for (const svg of document.querySelectorAll<SVGSVGElement>('.trail-path')) {
      const path = svg.querySelector<SVGPathElement>('path.lane-bed')
      const sb = svg.getBoundingClientRect()
      if (!path || sb.width < 1) continue
      const L = path.getTotalLength()
      const pts: [number, number][] = []
      for (let i = 0; i <= 600; i++) {
        const q = path.getPointAtLength((L * i) / 600)
        pts.push([sb.left + (q.x / 100) * sb.width, sb.top + (q.y / 100) * sb.height])
      }
      for (const n of svg.parentElement!.querySelectorAll<HTMLElement>('.node .level-name')) {
        const b = n.getBoundingClientRect()
        const h = pts.filter(([x, y]) => x > b.left && x < b.right && y > b.top && y < b.bottom).length
        if (h) out[n.textContent ?? '?'] = h
      }
    }
    return out
  })
}

test("the lane passes round a row's turning stop and an act's last stop, not across their names", async ({ page, hasTouch }) => {
  const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
  await page.goto('/hedgerow/?2d')
  await page.evaluate((st) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 21: true } })), stars)
  await page.goto('/hedgerow/')
  const name = page.locator('.node .level-name', { hasText: 'Brand Ambassador' })
  await expect(name).toBeVisible()
  await page.waitForTimeout(1500) // the stops' pop-in
  const hits = await laneOverNames(page)
  expect(hits['Brand Ambassador'] ?? 0).toBe(0)
  // A desktop has room outside every turn. An upright phone's edge columns are tight: the lane may graze a plate's
  // edge (a few samples of 600), never run through it (the old lane crossed 20-40).
  for (const [n, h] of Object.entries(hits)) expect(h, n).toBeLessThanOrEqual(hasTouch ? 9 : 0)
  // Names never meet after any nudging.
  const meets = await page.evaluate(() => {
    const out: string[] = []
    for (const t of document.querySelectorAll('.trail')) {
      const b = [...t.querySelectorAll('.node .level-name')].map((e) => e.getBoundingClientRect())
      for (let i = 0; i < b.length; i++)
        for (let j = i + 1; j < b.length; j++)
          if (b[i]!.left < b[j]!.right - 1 && b[j]!.left < b[i]!.right - 1 && b[i]!.top < b[j]!.bottom - 1 && b[j]!.top < b[i]!.bottom - 1) out.push(`${i}/${j}`)
    }
    return out
  })
  expect(meets).toEqual([])
})
