import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Plan item 368 slice 1: on an upright phone Cath's line and the farm's goods are one wooden counter under the board:
// the dock and the goods meet with no gap, her line is chalk on a slate (no bubble border or tail), and the goods'
// figures pass AA on the wood in both themes.
for (const scheme of ['light', 'dark'] as const) {
  test(`Cath's line and the goods are one counter (${scheme})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'the upright phone')
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game .cath-dock').waitFor()
    const m = await page.evaluate(() => {
      const dock = document.querySelector<HTMLElement>('.cath-dock')!
      const goods = document.querySelector<HTMLElement>('.action-tray .active-producer')!
      const line = document.querySelector<HTMLElement>('.cath-dock-line')!
      const map = document.querySelector<HTMLElement>('.map-wrap')!.getBoundingClientRect()
      const cs = getComputedStyle(line)
      return {
        gap: goods.getBoundingClientRect().top - dock.getBoundingClientRect().bottom,
        lineBorder: cs.borderTopWidth,
        tail: getComputedStyle(line, '::after').display,
        lineSize: parseFloat(cs.fontSize),
        wood: getComputedStyle(dock).backgroundImage.includes('gradient') && getComputedStyle(goods).backgroundImage.includes('gradient'),
        goodsBorder: getComputedStyle(goods).borderTopWidth,
        mapH: map.height,
      }
    })
    expect(m.gap).toBeLessThanOrEqual(0.5)
    expect(m.lineBorder).toBe('0px')
    expect(m.tail).toBe('none')
    expect(m.lineSize).toBeGreaterThanOrEqual(13)
    expect(m.wood).toBe(true)
    expect(m.goodsBorder).toBe('0px')
    expect(m.mapH).toBeGreaterThanOrEqual(415)
    const axe = await new AxeBuilder({ page }).include('.cath-dock').include('.action-tray .active-producer').withRules(['color-contrast']).analyze()
    expect(axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([])
  })
}

// Plan item 368 slice 2: the hand on the counter holds three whole cards (their names unclipped) without a swipe, the
// count of cards to the right hangs from the counter's lip clear of every card, and the not-yet deck is "Saving for".
// Run with the held fan allowed (`?e2eHandFan=1`), as a player sees it: the counter turns the fan off.
for (const scheme of ['light', 'dark'] as const) {
  test(`the counter's hand shows three whole cards and its count off them (${scheme})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'the upright phone')
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/?e2eHandFan=1')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game .cath-dock').waitFor()
    await page.waitForTimeout(600)
    const read = () => page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.action-tray .actions')!
      const rr = row.getBoundingClientRect()
      const well = document.querySelector<HTMLElement>('.action-tray .actions-well')!
      const wr = well.getBoundingClientRect()
      const pill = getComputedStyle(well, '::before')
      const pillBox = pill.content === 'none' ? null : {
        top: wr.top + parseFloat(pill.top), bottom: wr.top + parseFloat(pill.top) + parseFloat(pill.height),
        right: wr.right - parseFloat(pill.right), left: wr.right - parseFloat(pill.right) - parseFloat(pill.width),
      }
      const cards = [...row.querySelectorAll<HTMLElement>(':scope > .action-item')]
      const whole = cards.filter((c) => {
        const label = c.querySelector('.action-label')!.getBoundingClientRect()
        return c.matches('[data-hand-card]') && label.width > 0 && label.left >= rr.left - 1 && label.right <= rr.right + 1
      }).length
      const meets = pillBox ? cards.filter((c) => {
        const r = c.getBoundingClientRect()
        return r.right > rr.left && r.left < rr.right && r.left < pillBox.right && r.right > pillBox.left && r.top < pillBox.bottom && r.bottom > pillBox.top
      }).length : 0
      return {
        whole, meets, pill: pill.content,
        peeks: row.querySelectorAll('[data-peek]').length,
        later: document.querySelector('.action-tray .action-head-later')?.textContent ?? '',
        mapH: document.querySelector<HTMLElement>('.map-wrap')!.getBoundingClientRect().height,
        small: cards.filter((c) => c.getBoundingClientRect().height < 44).length,
      }
    })
    await page.locator('.action-tray .actions').evaluate((el) => el.scrollTo({ left: 0 }))
    await page.waitForTimeout(300)
    const m = await read()
    expect(m.peeks).toBe(0)
    expect(m.whole).toBeGreaterThanOrEqual(3)
    expect(m.pill).toContain('more')
    expect(m.meets).toBe(0)
    expect(m.later).toBe('Saving for')
    expect(m.mapH).toBeGreaterThanOrEqual(415)
    expect(m.small).toBe(0)
  })
}

// Plan item 368 slice 3: a 375x667 phone (and any upright phone 640 px tall or more) gets the counter too: Cath's line
// and the goods under the board, three whole card names in the hand, and the whole board 260 px+ tall above them.
test('a 375x667 phone has the counter, three whole cards and the board above it', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the upright phone')
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/?e2eHandFan=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game .cath-dock').waitFor()
  await page.waitForTimeout(600)
  const m = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>('.map-wrap')!.getBoundingClientRect()
    const dock = document.querySelector<HTMLElement>('.action-tray .cath-dock')!.getBoundingClientRect()
    const tabs = document.querySelector<HTMLElement>('.tab-bar, nav[aria-label]')?.getBoundingClientRect()
    const whole = [...document.querySelectorAll<HTMLElement>('[data-hand-card] .action-label')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.left >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1
    }).length
    const cards = [...document.querySelectorAll<HTMLElement>('[data-hand-card]')].map((c) => c.getBoundingClientRect())
    return { mapH: map.height, mapBottom: map.bottom, dockTop: dock.top, whole, cardsBottom: Math.max(...cards.map((r) => r.bottom)), tabsTop: tabs?.top ?? innerHeight }
  })
  expect(m.mapH).toBeGreaterThanOrEqual(255)
  expect(m.dockTop).toBeGreaterThanOrEqual(m.mapBottom - 1)
  expect(m.whole).toBeGreaterThanOrEqual(3)
  expect(m.cardsBottom).toBeLessThanOrEqual(m.tabsTop + 1)
})

// Plan item 368 slice 4: the Saving for pile names its tucked cards on their edges (a spine each), legible (AA),
// inside the 34 px strip that shows, and the face-up card keeps its full face.
for (const scheme of ['light', 'dark'] as const) {
  test(`the Saving for pile's tucked cards show their names on the spine (${scheme})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'the upright phone')
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game .cath-dock').waitFor()
    await page.evaluate(() => {
      const a = document.querySelector<HTMLElement>('.action-tray .actions')!
      a.style.scrollBehavior = 'auto'
      a.scrollLeft = document.querySelector<HTMLElement>('.action-head-later')!.offsetLeft - 16
    })
    await page.waitForTimeout(400)
    const spines = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.action-head-later ~ .action-item:not([data-hand-card]):not(:last-child)')].map((c) => {
        const label = c.querySelector<HTMLElement>('.action-label')!
        const r = label.getBoundingClientRect()
        const cr = c.getBoundingClientRect()
        // the strip that shows runs from this card's left to the next card's (+3 px for the pile's 2 degree tilt)
        const next = (c.nextElementSibling as HTMLElement).getBoundingClientRect()
        return { box: [r.left, r.right, cr.left, next.left], text: label.innerText.trim(), opacity: getComputedStyle(label.closest('.action-label-group')!).opacity, w: r.width, inEdge: r.left >= cr.left - 1 && r.right <= next.left + 3 }
      }),
    )
    expect(spines.length).toBeGreaterThanOrEqual(3)
    for (const s of spines) {
      expect(s.text.length).toBeGreaterThan(0)
      expect(s.opacity).toBe('1')
      expect(s.inEdge, JSON.stringify(s.box)).toBe(true)
    }
    const axe = await new AxeBuilder({ page }).include('.action-head-later ~ .action-item:not(:last-child) .action-label').withRules(['color-contrast']).analyze()
    expect(axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([])
  })
}

// Plan item 383: on a phone each tally figure carries its word (Round, Trust, Land left, Rift), 12 px or more and
// whole, as item 366 gave the desktop.
test('the phone tally names each figure', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the upright phone')
  for (const size of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(size)
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.market-board .board-label').first().waitFor()
    const labels = await page.locator('.market-board .board-label').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect()
        const cell = e.closest('.board-cell')!.getBoundingClientRect()
        return { text: e.textContent, size: parseFloat(getComputedStyle(e).fontSize), w: r.width, whole: e.scrollWidth <= e.clientWidth + 1 && r.left >= cell.left - 1 && r.right <= cell.right + 1 }
      }),
    )
    expect(labels.map((l) => l.text)).toEqual(['Round', 'Trust', 'Land left', 'Rift'])
    for (const l of labels) {
      expect(l.size, JSON.stringify(l)).toBeGreaterThanOrEqual(12)
      expect(l.w > 10 && l.whole, JSON.stringify(l)).toBe(true)
    }
  }
})

// Plan item 383: Pell's medallion hangs from the papers rail's left end, its ring clear of the tally's foot and of
// Bea's drawing on the table; the rail's plates read at 13 px or more.
test("the rail's medallion clears the tally and the table's drawing", async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the upright phone')
  for (const size of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(size)
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.papers-placard-face').waitFor()
    const m = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect()
      const face = r('.papers-placard-face')
      const ring = 5 // the medallion's outer ring (box-shadow)
      const drawing = document.querySelector('.beas-drawing')?.getBoundingClientRect()
      return {
        gapTally: face.top - ring - r('.market-board').bottom,
        drawingGap: drawing ? drawing.top - (face.bottom + ring) : 99,
        overlapsX: drawing ? drawing.left < face.right + ring : false,
        plates: [...document.querySelectorAll('.papers-placard-words > *')].map((e) => parseFloat(getComputedStyle(e).fontSize)),
      }
    })
    expect(m.gapTally, JSON.stringify(m)).toBeGreaterThanOrEqual(0)
    if (m.overlapsX) expect(m.drawingGap, JSON.stringify(m)).toBeGreaterThanOrEqual(0)
    for (const f of m.plates) expect(f).toBeGreaterThanOrEqual(13)
  }
})
