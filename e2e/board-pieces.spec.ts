import { test, expect } from '@playwright/test'

// Plan item 63: an autoplayed game stopped at rounds 2, 5 and 8 (`e2eAutoplayUntil`), so each board is judged once it
// holds still: no two `[data-piece]` boxes on a tile overlap, none crosses the region's name plate, and every count
// reads at 11 px or more.
test('board pieces never overlap each other or the name plate', async ({ page }) => {
  test.setTimeout(150_000)
  for (const until of [2, 5, 8]) {
    await page.goto(`/?e2eAutoplay=1&e2eAutoplayUntil=${until}`)
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect
      // A game that ends early (the end screen) has no board left to judge.
      .poll(() => page.evaluate(() => (document.querySelector('.end-screen') ? 99 : Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0))), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(until)
    if (await page.locator('.end-screen').isVisible()) continue
    // The enemy turn's playback and the pieces' 200 ms slides settle first.
    await page.waitForTimeout(2500)
    const report = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('.map-wrap svg.map[data-round]')!
      const bad: string[] = []
      let pieces = 0
      let minCount = Infinity
      const overlap = (a: DOMRect, b: DOMRect, pad = 1) => a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad
      for (const hex of Array.from(svg.querySelectorAll<SVGGElement>('.region-hex'))) {
        const id = hex.dataset.region!
        const plate = svg.querySelector(`[data-sign="${id}"] .region-plaque`)?.getBoundingClientRect()
        const els = Array.from(hex.querySelectorAll<SVGGElement>('[data-piece]'))
        const boxes = els.map((el) => el.getBoundingClientRect())
        pieces += els.length
        for (let a = 0; a < boxes.length; a++) {
          if (plate && overlap(boxes[a]!, plate)) bad.push(`${id} ${els[a]!.dataset.piece} x plate`)
          for (let b = a + 1; b < boxes.length; b++) if (overlap(boxes[a]!, boxes[b]!)) bad.push(`${id} ${els[a]!.dataset.piece} x ${els[b]!.dataset.piece}`)
        }
        for (const t of Array.from(hex.querySelectorAll<SVGTextElement>('.piece-count text'))) minCount = Math.min(minCount, t.getBoundingClientRect().height)
      }
      return { round: Number(svg.dataset.round), bad, pieces, minCount }
    })
    expect(report.pieces, `round ${report.round}`).toBeGreaterThan(0)
    expect(report.bad, `round ${report.round}`).toEqual([])
    if (report.minCount !== Infinity) expect(report.minCount, `count text at round ${report.round}`).toBeGreaterThanOrEqual(11)
  }
})
