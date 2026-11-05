import { test, expect } from '@playwright/test'

// Plan item 172: pieces worth holding. An autoplayed Quick Game stopped at round 6 (`e2eAutoplayUntil`): every
// `[data-piece]` names its outline (`data-silhouette`, one per kind); the median piece is 36 px or more on a desktop
// board and 24 px on a phone, and none is under 32 / 20 px (a tile crowded with three kinds, a threat badge and two
// producers); two or three of a kind stand as a pile with no number; the hexes fill the board panel's height.
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
      return { kind: el.dataset.piece!, sil: el.dataset.silhouette ?? '', n: Number(el.dataset.count), tall: Math.max(b.width, b.height), badges: el.querySelectorAll('.piece-count').length, copies: el.querySelectorAll('.pile-copy').length }
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
    // A number only above three; two or three stand as a pile.
    expect(p.badges, `${p.kind} x${p.n}`).toBe(p.n >= 4 ? 1 : 0)
    expect(p.copies, `${p.kind} x${p.n}`).toBe(Math.min(p.n, 3) - 1)
  }
  if (desktop) expect(r.fill).toBeGreaterThanOrEqual(0.85)
})
