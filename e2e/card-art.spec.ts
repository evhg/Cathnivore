import { test, expect, type Page } from '@playwright/test'

// Plan item 722: every card has painted art. The hand's names read 15 px+ on a phone and 16 px+ on the wide desktop
// table (a name measured tight, two lines on the resting face, keeps 15/14 px: DECISIONS 2026-11-27), each Market card shows its own scene,
// no cost chip crosses a neighbour card, and the desktop hand's foot is on screen.
async function start(page: Page) {
  await page.goto('/?e2eHandFan=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await page.mouse.move(1, 1)
  await page.waitForTimeout(1200)
}

test('hand names are big enough and every chip stays on its own card', async ({ page }) => {
  const width = page.viewportSize()?.width ?? 0
  test.skip(width < 1400 && width >= 700, 'the phone and the wide desktop table')
  await start(page)
  const m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.table-hand .action-item, .action-tray .actions .action-item')]
      .filter((e) => e.getClientRects().length && e.querySelector(':scope > button:first-child:not(:disabled)'))
    const vw = window.innerWidth
    const onScreen = cards.filter((c) => {
      const r = c.getBoundingClientRect()
      return r.right > 0 && r.left < vw
    })
    const fonts = onScreen.map((c) => ({
      name: c.textContent ?? '',
      tight: !!c.querySelector(':scope > button[data-tight]'),
      px: parseFloat(getComputedStyle(c.querySelector('.action-label')!).fontSize),
    }))
    const crossings: string[] = []
    onScreen.forEach((c, i) => {
      const chip = c.querySelector('.action-cost')?.getBoundingClientRect()
      const next = onScreen[i + 1]?.getBoundingClientRect()
      if (!chip || !next) return
      const w = Math.min(chip.right, next.right) - Math.max(chip.left, next.left)
      const h = Math.min(chip.bottom, next.bottom) - Math.max(chip.top, next.top)
      if (w > 1 && h > 1) crossings.push(`${c.textContent} chip under the next card (${w.toFixed(0)}x${h.toFixed(0)})`)
    })
    const bottom = Math.max(...onScreen.map((c) => c.getBoundingClientRect().bottom))
    return { fonts, crossings, bottom, vh: window.innerHeight }
  })
  expect(m.fonts.length).toBeGreaterThan(1)
  const desk = width >= 1400
  for (const f of m.fonts) expect(f.px, f.name).toBeGreaterThanOrEqual(desk ? (f.tight ? 14 : 16) : 15)
  expect(m.crossings).toEqual([])
  expect(m.bottom).toBeLessThanOrEqual(m.vh)
})

test('every Market card shows its own painted scene', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: /^Market/ }).first().click()
  const cards = page.locator('.card-list [data-buy-card]')
  await expect(cards.first()).toBeVisible()
  const rows = await cards.evaluateAll((els) =>
    els.filter((e) => e.getClientRects().length).map((e) => {
      const art = e.querySelector<SVGElement>('svg.card-vignette')
      const r = art?.getBoundingClientRect()
      return { id: e.getAttribute('data-buy-card'), art: art?.getAttribute('data-card-art'), w: r?.width ?? 0, h: r?.height ?? 0 }
    }),
  )
  for (const r of rows) {
    expect(r.art, `${r.id}'s scene`).toBe(r.id)
    expect(r.w, `${r.id}'s window`).toBeGreaterThanOrEqual(80)
    expect(r.h, `${r.id}'s window`).toBeGreaterThanOrEqual(44)
  }
})
