import { expect, test, type Page } from '@playwright/test'

// Plan item 122: one Cath. At D the valley figure speaks: her line is a bubble beside her head (15 px or more,
// meeting no tile) with its tail ending within 24 px of her face, and the side portrait goes. On a board with no
// room beside her the line stays in the sidebar without the portrait. Her face follows the water: worried on a
// spill, a wink on the solve. On a phone (plan item 165) the one Cath stands in the valley, 120 px or taller at 390,
// meeting no tile, her line in the card above with no portrait.

const visibleCaths = (page: Page) =>
  page.evaluate(() =>
    ['host-face', 'valley-cath'].filter((id) => {
      const el = document.getElementById(id)!
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || getComputedStyle(el).display === 'none' || !el.querySelector('svg')) return false
      // Seen, not just laid out: the sidebar's visually hidden host clips its portrait away.
      for (let a: Element | null = el; a; a = a.parentElement) if (getComputedStyle(a).clipPath.startsWith('inset')) return false
      return true
    }),
  )

for (const date of ['2026-11-03', '2026-11-04', '2026-11-08']) {
  test(`one Cath at D, speaking from the valley (${date})`, async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'the phone has its own test below')
    await page.clock.setFixedTime(new Date(`${date}T10:00:00Z`))
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    await expect.poll(() => visibleCaths(page)).toHaveLength(1)
    const say = page.locator('#valley-say')
    if (!(await say.isVisible())) {
      // No room on this board: the sidebar line, without the portrait.
      await expect(page.locator('.app')).toHaveAttribute('data-valley-say', 'side')
      return
    }
    expect(await visibleCaths(page)).toEqual(['valley-cath'])
    const m = await page.evaluate(() => {
      const s = document.getElementById('valley-say')!
      const cs = getComputedStyle(s)
      const tail = getComputedStyle(s, '::after')
      const r = s.getBoundingClientRect()
      const c = document.getElementById('valley-cath')!
      const f = c.getBoundingClientRect()
      // (plan item 430: full length at D, her face the box's top quarter)
      const full = c.dataset.framing === 'full'
      const face = { l: f.left + f.width * 0.3, r: f.left + f.width * 0.7, t: f.top + f.height * (full ? 0.04 : 0.1), b: f.top + f.height * (full ? 0.25 : 0.42) }
      const a = parseFloat(cs.getPropertyValue('--tail-a'))
      const len = parseFloat(tail.width)
      const ex = r.left + parseFloat(tail.left) + Math.cos(a) * len
      const ey = r.top + parseFloat(tail.top) + Math.sin(a) * len
      const dist = Math.hypot(Math.max(face.l - ex, ex - face.r, 0), Math.max(face.t - ey, ey - face.b, 0))
      // Any tile under the bubble's own box?
      let onTile = false
      for (let x = r.left + 1; x < r.right; x += 6) {
        for (let y = r.top + 1; y < r.bottom; y += 6) {
          if (document.elementsFromPoint(x, y).some((e) => e.matches('#board polygon.tile'))) onTile = true
        }
      }
      return { font: parseFloat(cs.fontSize), dist, onTile, text: s.textContent }
    })
    expect(m.font).toBeGreaterThanOrEqual(15)
    expect(m.dist).toBeLessThanOrEqual(24)
    expect(m.onTile).toBe(false)
    expect(m.text).toBe(await page.locator('#host-line').textContent())
  })
}

// Under reduced motion every property ran a 1 ms transition, so her figure, re-sized and measured in one frame, read
// its old size and her bubble was placed over her face (critique 2026-11-12, 1440x900).
test('at D under reduced motion her bubble is off her figure', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop figure')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00Z'))
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  await expect(page.locator('#valley-say')).toBeVisible()
  await page.waitForTimeout(800)
  const o = await page.evaluate(() => {
    const s = document.getElementById('valley-say')!.getBoundingClientRect()
    const c = document.getElementById('valley-cath')!
    let f = c.getBoundingClientRect()
    // (plan item 694: from the rail's foot at half length her bubble sits beside her head inside her box's empty
    // corner, so it is checked against her face and hair: 0.26-0.74 of the width, the top 0.46)
    if (c.closest('.rail-host')) f = new DOMRect(f.left + f.width * 0.26, f.top, f.width * 0.48, f.height * 0.46)
    return Math.max(0, Math.min(s.right, f.right - 6) - Math.max(s.left, f.left + 6)) * Math.max(0, Math.min(s.bottom, f.bottom) - Math.max(s.top, f.top + 4))
  })
  expect(o).toBe(0)
})

// Plan item 268: the third mood. A tap that joins the water to the lesson's field cheers her (the solve board keeps a
// spill after a tile turns back, so the lesson is the clean case): delighted, after a wink for the groove lined up.
test('a tap that joins the water to the field delights her', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the valley figure is a full-length Cath at D')
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00Z'))
  await page.goto('/runnel/')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  const cath = page.locator('#valley-cath')
  await expect(cath).toHaveAttribute('data-mood', 'calm')
  const target = page.locator('.tiles > g.cell.lesson-target')
  for (let i = 0; i < 6 && (await target.count()); i++) {
    await target.first().click()
    await page.waitForTimeout(400)
  }
  await expect(target).toHaveCount(0)
  await expect(cath).toHaveAttribute('data-mood', 'delighted')
  await expect(cath).toHaveAttribute('data-expression', 'delighted')
})

test('her face follows the water: worried on a spill, delighted on the solve', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the valley figure is a full-length Cath at D')
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00Z'))
  await page.goto('/runnel/?nohelp&shotsolve')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  const cath = page.locator('#valley-cath')
  // Turning a joined channel out of line spills the water.
  const tile = page.locator('.tiles > g.cell:not(.stone):not(.fixed):not([data-last])').nth(2)
  await tile.click()
  await expect(cath).toHaveAttribute('data-expression', 'worried')
  // Plan item 268: her body too: a hand to her chin while it spills, a wave on the solve.
  await expect(cath).toHaveAttribute('data-mood', 'worried')
  await expect(cath).toHaveAttribute('data-pose', 'thinking')
  for (let k = 0; k < 5; k++) await tile.click()
  await page.locator('[data-last]').click()
  // Plan item 411: delighted on the solve (it was a wink), as the water runs on to Bea's garden.
  await expect(cath).toHaveAttribute('data-expression', 'delighted')
  await expect(cath).toHaveAttribute('data-mood', 'delighted')
  await expect(cath).toHaveAttribute('data-pose', 'wave')
})

// Plan item 407: on an upright phone she is docked under the board, her portrait and line in one card, off the field.
for (const date of ['2026-11-03', '2026-11-04', '2026-11-08']) {
  test(`one Cath on a phone: docked under the board (${date})`, async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'the phone')
    await page.clock.setFixedTime(new Date(`${date}T10:00:00Z`))
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    await expect.poll(() => visibleCaths(page)).toEqual(['host-face'])
    const m = await page.evaluate(() => {
      const host = document.querySelector('.host')!.getBoundingClientRect()
      const board = document.getElementById('board')!.getBoundingClientRect()
      const st = document.querySelector('.stage')!.getBoundingClientRect()
      const line = getComputedStyle(document.getElementById('host-line')!)
      const meets = host.left < board.right && board.left < host.right && host.top < board.bottom && board.top < host.bottom
      return { below: host.top >= st.bottom - 1, meets, font: parseFloat(line.fontSize), onScreen: host.bottom <= innerHeight }
    })
    expect(m.below).toBe(true)
    expect(m.meets).toBe(false)
    expect(m.onScreen).toBe(true)
    expect(m.font).toBeGreaterThanOrEqual(15)
    // Still one after a tap.
    await page.locator('.tiles > g.cell:not(.stone):not(.fixed)').first().click()
    await page.waitForTimeout(300)
    expect(await visibleCaths(page)).toEqual(['host-face'])
  })
}

test('on a phone her face follows the solve', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the phone')
  await page.goto('/runnel/?nohelp&practice')
  await expect(page.locator('#host-face svg')).toBeVisible()
  const before = await page.locator('#host-face').getAttribute('data-expression')
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  await page.locator('#board [data-last]').click()
  await expect(page.locator('#host-face')).not.toHaveAttribute('data-expression', before ?? '')
})

// Plan item 188 hid the half-length figure's cut at the hips behind a wall, then a footbridge (items 329, 351, 369),
// which still read as a box over her hips. Plan item 430: at D she stands full length in the meadow, her boots on the
// valley's grass with a few tufts in front of them; no board or wall crosses her.
// (Plan item 694: where the rail's foot has room, 1440x900, she hosts from there at half length; on a short desktop
// she stands in the valley as before.)
test('at D she stands full length in the meadow, nothing across her hips', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the phone docks her under the board (item 407)')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00Z'))
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  await expect.poll(() => visibleCaths(page)).toEqual(['valley-cath'])
  await expect(page.locator('#valley-cath')).toHaveAttribute('data-framing', 'full')
  const m = await page.evaluate(() => {
    const c = document.getElementById('valley-cath')!
    const fig = c.querySelector('svg.cath')!
    const r = fig.getBoundingClientRect()
    const boots = c.querySelector('.cath-lower')!.getBoundingClientRect()
    const bank = c.querySelector('svg.valley-bank')!.getBoundingClientRect()
    const valley = document.querySelector('.valley')!.getBoundingClientRect()
    return {
      viewBox: fig.getAttribute('viewBox'),
      walls: c.querySelectorAll('svg.valley-wall').length,
      bootsBottom: boots.bottom,
      bankTop: bank.top,
      bankBottom: bank.bottom,
      valleyBottom: valley.bottom,
      figTop: r.top,
      valleyTop: valley.top,
    }
  })
  // Plan item 524: the full framing (legs stretched below the hip, the top trimmed).
  expect(m.viewBox).toBe('20 50 360 898')
  expect(m.walls).toBe(0)
  // Her boots stand inside the valley, the tufts round them (no higher than her shins), the whole of her in view.
  expect(m.bootsBottom).toBeLessThanOrEqual(m.valleyBottom - 4)
  expect(m.bankBottom).toBeGreaterThanOrEqual(m.bootsBottom - 2)
  expect(m.bankTop).toBeGreaterThanOrEqual(m.bootsBottom - 40)
  expect(m.figTop).toBeGreaterThanOrEqual(m.valleyTop)
})
