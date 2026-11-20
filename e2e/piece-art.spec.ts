import { test, expect } from '@playwright/test'

// Plan item 554: the pieces as miniatures on the table. Hollowell's moulded pieces fill their slots (the plinth's
// lip no longer reserves room for item 172's old pile of copies) and the producers stand on wider turned-wood
// standees, about 1.2x their old art. Slice 1's ratchet on a fixed deal (was 39 / 32 px at D and 22 / 18 at P,
// round 1 / round 6): the median piece's art 42 / 35 px wide at 1440x900 and 24 / 20 at 390x844, none under 28 / 16.
// The item's 48 / 28 needs the landmark to yield room in crowded hexes (slice 2).
for (const round of [1, 6]) {
  test(`pieces are miniatures at round ${round}`, async ({ page }, info) => {
    test.setTimeout(120_000)
    const vw = page.viewportSize()?.width ?? 0
    test.skip(vw > 400 && vw < 1024, 'phone portrait and desktop only')
    const desktop = vw >= 1024
    // A fixed deal (the Setup rolls its seed from Math.random), so the sizes compare run to run.
    await page.addInitScript(() => {
      let a = 554
      Math.random = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296)
    })
    await page.goto(`/?e2eAutoplay=1&e2eAutoplayUntil=${round}`)
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect
      .poll(() => page.evaluate(() => (document.querySelector('.end-screen') ? 99 : Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0))), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(round)
    test.skip(await page.locator('.end-screen').isVisible(), 'the game ended early')
    await page.waitForTimeout(2500)
    const widths = await page.evaluate(() =>
      Array.from(document.querySelectorAll<SVGGElement>('.map-wrap svg.map[data-round] .piece-tray .enemy-piece, .map-wrap svg.map[data-round] .piece-tray .stall-piece')).map((el) => ({
        kind: el.classList.contains('stall-piece') ? 'stall' : (el.getAttribute('class') ?? '').replace('enemy-piece ', ''),
        w: Math.round(el.getBoundingClientRect().width * 10) / 10,
      })),
    )
    info.annotations.push({ type: 'widths', description: JSON.stringify(widths) })
    expect(widths.length).toBeGreaterThan(0)
    const sorted = widths.map((p) => p.w).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]!
    const floor = desktop ? (round === 1 ? 42 : 35) : round === 1 ? 24 : 20
    expect(median, `median piece art ${JSON.stringify(widths)}`).toBeGreaterThanOrEqual(floor)
    for (const p of widths) expect(p.w, `${p.kind} art`).toBeGreaterThanOrEqual(desktop ? 28 : 16)
  })
}
