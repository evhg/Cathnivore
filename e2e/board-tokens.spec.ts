import { test, expect } from '@playwright/test'

// Plan item 172: pieces worth holding. An autoplayed Quick Game stopped at round 6 (`e2eAutoplayUntil`): every
// `[data-piece]` names its outline (`data-silhouette`, one per kind); the median piece is 36 px or more on a desktop
// board and 24 px on a phone, and none is under 32 / 20 px (a tile crowded with three kinds, a threat badge and two
// producers); a producer's two or three stalls stand as a pile with no number, while Hollowell's pieces are one
// glossy piece a kind with a count from two (plan item 413); the hexes fill the board panel's height.
const KINDS: Record<string, string> = { o: 'sawtooth', b: 'peak', d: 'bubble', stall: 'standee' }

test('board pieces are chunky tokens with their own outlines', async ({ page }, info) => {
  test.setTimeout(120_000)
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=6')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('.end-screen') ? 99 : Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0))), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(6)
  test.skip(await page.locator('.end-screen').isVisible(), 'the game ended before round 6')
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('.map-wrap svg.map[data-round]')!
    const pieces = Array.from(svg.querySelectorAll<SVGGElement>('[data-piece]')).map((el) => {
      const b = el.getBoundingClientRect()
      // Plan item 425: Hollowell's miniatures cast a contact shadow, and a count sits on the piece (its plinth),
      // its gap to the piece's art box (the model and its plinth) 4 px or less.
      const art = el.querySelector('.enemy-stack > g')?.getBoundingClientRect()
      const badge = el.querySelector('.piece-count')?.getBoundingClientRect()
      const gap = art && badge ? Math.max(0, badge.left - art.right, art.left - badge.right, badge.top - art.bottom, art.top - badge.bottom) : 0
      return { kind: el.dataset.piece!, sil: el.dataset.silhouette ?? '', n: Number(el.dataset.count), tall: Math.max(b.width, b.height), badges: el.querySelectorAll('.piece-count').length, copies: el.querySelectorAll('.pile-copy').length, shadow: el.querySelectorAll('.corp-base-shadow, .token-shadow').length, gap }
    })
    const hexes = Array.from(svg.querySelectorAll('.region-hex polygon')).map((p) => p.getBoundingClientRect())
    const top = Math.min(...hexes.map((h) => h.top))
    const bottom = Math.max(...hexes.map((h) => h.bottom))
    const panel = document.querySelector('.map-wrap')!.getBoundingClientRect()
    return { pieces, fill: (bottom - top) / panel.height }
  })
  expect(r.pieces.length).toBeGreaterThan(0)
  const floor = desktop ? 32 : 20
  const sizes = r.pieces.map((p) => p.tall).sort((a, b) => a - b)
  expect(sizes[Math.floor(sizes.length / 2)]!, 'median piece').toBeGreaterThanOrEqual(desktop ? 36 : 24)
  for (const p of r.pieces) {
    expect(p.sil, p.kind).toBe(KINDS[p.kind])
    expect(p.tall, `${p.kind} x${p.n} (${info.project.name})`).toBeGreaterThanOrEqual(floor)
    if (p.kind === 'stall') {
      // A number only above three; two or three stand as a pile.
      expect(p.badges, `${p.kind} x${p.n}`).toBe(p.n >= 4 ? 1 : 0)
      expect(p.copies, `${p.kind} x${p.n}`).toBe(Math.min(p.n, 3) - 1)
    } else {
      expect(p.shadow, `${p.kind} contact shadow`).toBeGreaterThan(0)
      // Plan item 413: one Hollowell piece a kind; item 550: no count disc on it (the region's status disc counts).
      expect(p.badges, `${p.kind} x${p.n}`).toBe(0)
      expect(p.copies, `${p.kind} x${p.n}`).toBe(0)
    }
  }
  if (desktop) expect(r.fill).toBeGreaterThanOrEqual(0.85)
})
