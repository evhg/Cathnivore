import { test, expect } from '@playwright/test'

// Plan item 554: the pieces as miniatures on the table. Hollowell's moulded pieces fill their slots (the plinth's
// lip no longer reserves room for item 172's old pile of copies) and the producers stand on wider turned-wood
// standees, about 1.2x their old art. Slice 1's ratchet on a fixed deal (was 39 / 32 px at D and 22 / 18 at P,
// round 1 / round 6): the median piece's art 42 / 35 px wide at 1440x900 and 24 / 20 at 390x844, none under 28 / 16.
// Slice 2 (the row steps off the middle column so the landmark stands beside it; no room kept for item 550's retired
// threat badge): 48.5 / 38.5 at D and 27.5 / 21.9 at P. The item's 48 holds at D round 1; 28 at P needs a tighter
// three-stack row (slice 3).
// Slice 3 (Doubt's bubble and the standees fill their slots; with all three of Hollowell's kinds on a hex, Doubt may
// stand behind the Outlet and the Buyout as a two-deep cluster): 49.8 / 39.8 at D and 28.2 / 22.7 at P.
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
    // Plan item 740: the producers' stalls are the pieces that hold room (the landmark the hex's hero above them),
    // Hollowell's stacks glossy badges under them: the stalls' median art 49 / 30 px wide at D (round 1 / 6) and
    // 27 / 20 at P; every Hollowell piece 20 px+ at D and 14+ at P, and the stalls' median over Hollowell's.
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
    const stalls = widths.filter((p) => p.kind === 'stall').map((p) => p.w)
    const corp = widths.filter((p) => p.kind !== 'stall').map((p) => p.w)
    if (stalls.length) {
      const floor = desktop ? (round === 1 ? 49 : 30) : round === 1 ? 27 : 20
      expect(med(stalls), `median stall art ${JSON.stringify(widths)}`).toBeGreaterThanOrEqual(floor)
      if (corp.length) expect(med(stalls), 'stalls over Hollowell').toBeGreaterThan(med(corp))
    }
    for (const w of corp) expect(w, 'Hollowell piece art').toBeGreaterThanOrEqual(desktop ? 20 : 14)
  })
}
