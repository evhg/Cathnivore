import { test, expect } from '@playwright/test'

// Plan item 341: each region's landmark reads at a glance on the play board, as the campaign map draws it: about a
// quarter of the hex tall wherever the pieces leave room at their own size (data-full: 56 px+ at D, 26 px+ on a
// phone), never a faint sketch, its ink 3:1+ against its own tile's ground (sampled from pixels).
test('landmarks stand at the campaign scale in full ink', async ({ page }, info) => {
  const phone = info.project.name.startsWith('phone')
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=4')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('.end-screen') ? 99 : Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0))), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(4)
  test.skip(await page.locator('.end-screen').isVisible(), 'the game ended early')
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' })
  await expect.poll(() => page.locator('.map-wrap .board-landmark').count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(7)
  // The autoplay stops as round 4 begins; wait out its banner so nothing lies over the board.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('.map-wrap .board-landmark')).every((g) => {
            const r = g.getBoundingClientRect()
            return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.map-wrap')
          }),
        ),
      { timeout: 15_000 },
    )
    .toBe(true)
  await page.waitForTimeout(800)
  const lms = await page.evaluate(() =>
    Array.from(document.querySelectorAll<SVGGElement>('.map-wrap .board-landmark')).map((g, i) => {
      g.dataset.probe = String(i)
      const r = g.getBoundingClientRect()
      let o = 1
      for (let e: Element | null = g; e && e.tagName !== 'svg'; e = e.parentElement) o *= Number(getComputedStyle(e).opacity)
      return { i, kind: g.dataset.landmark!, full: g.dataset.full === 'true', target: Number(g.dataset.target), grip: Number(g.dataset.grip ?? 0), x: r.x, y: r.y, w: r.width, h: r.height, o }
    }),
  )
  expect(lms.length).toBeGreaterThanOrEqual(7)
  const full = lms.filter((l) => l.full)
  // The readable size is a quarter of the hex (data-target, from landmarkMinScale), 26 px at least.
  for (const l of lms) expect(l.target, l.kind).toBeGreaterThanOrEqual(26)
  // A tile that keeps room for it draws it at that size (its longer side: the fold and the docks are wide and low,
  // the light tall and narrow); a crowded one (stacks and stalls across the face) takes the largest that fits.
  expect(full.length, JSON.stringify(lms)).toBeGreaterThanOrEqual(3)
  for (const l of lms) {
    expect(l.o, l.kind).toBeGreaterThanOrEqual(0.99)
    expect(Math.max(l.w, l.h), `${l.kind} ${l.w}x${l.h}`).toBeGreaterThanOrEqual(l.full ? l.target * 0.82 : phone ? 15 : 28)
  }
  // The ink: the darkest of the landmark's pixels against the same box with it hidden (its tile's own ground).
  const lum = async (png: Buffer, pct: number) =>
    page.evaluate(
      async ({ b64, pct }) => {
        const img = new Image()
        img.src = `data:image/png;base64,${b64}`
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const x = c.getContext('2d')!
        x.drawImage(img, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data
        const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        const ls: number[] = []
        for (let i = 0; i < d.length; i += 4) ls.push(0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!))
        ls.sort((a, b) => a - b)
        return ls[Math.floor((ls.length - 1) * pct)]!
      },
      { b64: png.toString('base64'), pct },
    )
  // Held landmarks wear Hollowell's props (boards, the SOLD sign) over them; judge the ones still free.
  for (const l of full.filter((l) => l.grip < 3)) {
    const clip = { x: l.x, y: l.y, width: Math.max(4, l.w), height: Math.max(4, l.h) }
    const shot = await page.screenshot({ clip })
    const ink = await lum(shot, 0.03)
    await page.addStyleTag({ content: `.board-landmark[data-probe="${l.i}"] { visibility: hidden !important; }` })
    const ground = await lum(await page.screenshot({ clip }), 0.5)
    await page.addStyleTag({ content: `.board-landmark[data-probe="${l.i}"] { visibility: visible !important; }` })
    expect((ground + 0.05) / (ink + 0.05), l.kind).toBeGreaterThanOrEqual(3)
  }
})
