import { expect, test, type Locator, type Page } from '@playwright/test'

// Plan item 54: the phone Setup deals you in, the two picked producers' abilities read in full. Plan item 349: its
// header is Cath's stall (her at half length, 160 px+). Plan item 461: below it, three swiped steps under a dot rail
// (who, where, how hard) and Start fixed at the foot: the page never scrolls, each step's controls show whole on the
// screen and clear of Start, and Cath's line follows the step. Setup also works from the keyboard alone, and every
// card has a name.

async function clearOfStart(page: Page, el: Locator, what: string) {
  const vw = page.viewportSize()!.width
  const vh = page.viewportSize()!.height
  const b = (await el.boundingBox())!
  expect(b, what).not.toBeNull()
  expect(b.x, `${what} left`).toBeGreaterThanOrEqual(-0.5)
  expect(b.x + b.width, `${what} right`).toBeLessThanOrEqual(vw + 0.5)
  expect(b.y, `${what} top`).toBeGreaterThanOrEqual(0)
  expect(b.y + b.height, `${what} bottom`).toBeLessThanOrEqual(vh + 0.5)
  if (what === 'Start') return
  const start = (await page.getByRole('button', { name: 'Start' }).boundingBox())!
  expect(b.y + b.height, `${what} clear of Start`).toBeLessThanOrEqual(start.y + 0.5)
}

async function showStep(page: Page, i: number) {
  await page.locator('.setup-dot').nth(i).click()
  await expect(page.locator('.setup-dot').nth(i)).toHaveAttribute('aria-current', 'step')
  // The track has settled on the panel.
  await expect.poll(() => page.locator('.setup-panel').nth(i).evaluate((p) => Math.round(p.getBoundingClientRect().left))).toBeLessThanOrEqual(1)
  await expect.poll(() => page.locator('.setup-panel').nth(i).evaluate((p) => Math.round(p.getBoundingClientRect().left))).toBeGreaterThanOrEqual(-1)
}

test('the phone Setup is three steps on one screen: every control whole and clear of Start, the pair read in full', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the upright phone layout')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  // Plan item 349: Cath at half length in the stall header.
  const stand = (await page.locator('.setup-header-stand').boundingBox())!
  expect(stand.height).toBeGreaterThanOrEqual(160)
  await clearOfStart(page, page.locator('.setup-header-stand'), 'Cath')
  await clearOfStart(page, page.getByRole('button', { name: 'Start' }), 'Start')
  // Plan item 461: no page scroll at all.
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
  await expect(page.locator('.setup-dot')).toHaveCount(3)

  // Pick Ines and Sol (cards 3 and 4), so the picked pair isn't simply the first two.
  await page.locator('.producer-card', { hasText: 'Mara Keel' }).click()
  await page.locator('.producer-card', { hasText: 'Tomas Reed' }).click()
  await page.locator('.producer-card', { hasText: 'Ines Farrow' }).click()
  await page.locator('.producer-card', { hasText: 'Sol Abara' }).click()
  await expect(page.locator('.producer-card input:checked')).toHaveCount(2)

  const steps: Array<Array<[Locator, string]>> = [
    [
      ...(await page.locator('.producer-card').all()).map((c, i) => [c, `producer ${i + 1}`] as [Locator, string]),
      ...(await page.locator('.setup-mode label').all()).map((c, i) => [c, `mode ${i + 1}`] as [Locator, string]),
      [page.getByRole('button', { name: 'Use recommended pair' }), 'recommended'],
      ...(await page.locator('.pair-ability').all()).map((c, i) => [c, `ability ${i + 1}`] as [Locator, string]),
    ],
    [
      ...(await page.locator('.layout-tile').all()).map((c, i) => [c, `map ${i + 1}`] as [Locator, string]),
      [page.getByRole('button', { name: 'Previous map' }), 'previous map'],
      [page.getByRole('button', { name: 'Next map' }), 'next map'],
      [page.getByRole('button', { name: 'Advanced' }), 'Advanced'],
    ],
    (await page.locator('.setup-difficulty label').all()).map((c, i) => [c, `difficulty ${i + 1}`] as [Locator, string]),
  ]
  expect(steps.flat().length).toBe(4 + 2 + 1 + 2 + 3 + 3 + 3)
  for (const [i, controls] of steps.entries()) {
    await showStep(page, i)
    for (const [el, what] of controls) await clearOfStart(page, el, `step ${i + 1}: ${what}`)
    await clearOfStart(page, page.getByRole('button', { name: 'Start' }), 'Start')
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
  }

  // The picked pair's abilities, in full: not clipped by their box.
  await showStep(page, 0)
  const abilities = page.locator('.pair-ability')
  await expect(abilities.nth(0)).toContainText('Remove 1 Doubt from a region with your Stall, at no cost.')
  await expect(abilities.nth(1)).toContainText('Public Trust +1, or gain 2 Goodwill.')
  for (const i of [0, 1]) expect(await abilities.nth(i).evaluate((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await expect(page.locator('.pair-line')).toContainText('Doubt cleared')

  // Step 2: one large board between the arrows; the arrows and the names pick the map; Cath names it.
  await page.getByRole('button', { name: /Next: Where you trade/ }).click()
  await expect(page.locator('.setup-dot').nth(1)).toHaveAttribute('aria-current', 'step')
  const board = (await page.locator('.map-stage .board-mini').boundingBox())!
  expect(board.width).toBeGreaterThanOrEqual(200)
  await expect(page.locator('.setup-cath-line')).toContainText('The Ring')
  await page.getByRole('button', { name: 'Next map' }).click()
  await expect(page.getByRole('radio', { name: /The Long Coast/ })).toBeChecked()
  await expect(page.locator('.map-stage-name')).toHaveText('The Long Coast')
  await expect(page.locator('.setup-cath-line')).toContainText('The Long Coast')
  await page.getByRole('button', { name: 'Previous map' }).click()
  await page.getByRole('button', { name: 'Previous map' }).click()
  await expect(page.getByRole('radio', { name: /The Delta/ })).toBeChecked()
  await expect(page.locator('input[inputmode="numeric"]')).toBeHidden()
  await page.getByRole('button', { name: 'Advanced' }).click()
  await expect(page.locator('input[inputmode="numeric"]')).toBeVisible()
  await clearOfStart(page, page.locator('input[inputmode="numeric"]'), 'seed')

  // Step 3: every difficulty keeps the screen whole; Cath speaks for the level.
  await page.getByRole('button', { name: /Next: How hard/ }).click()
  for (const i of [0, 2, 1]) {
    await page.locator('.setup-difficulty label').nth(i).click()
    await clearOfStart(page, page.locator('.difficulty-sheet'), `sheet ${i + 1}`)
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
  }
  await expect(page.locator('.setup-cath-line')).toContainText('A fair fight')
  await clearOfStart(page, page.locator('.setup-panel .pin-tin'), 'pins')
})

test('Setup to Start from the keyboard alone, every card named', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()

  // Screen reader names: each producer checkbox carries the name and ability; each mode, level and map is a radio.
  for (const name of ['Mara Keel', 'Tomas Reed', 'Dr Ines Farrow', 'Sol Abara']) {
    await expect(page.getByRole('checkbox', { name: new RegExp(name) })).toHaveCount(1)
  }
  await expect(page.getByRole('checkbox', { name: /Sol Abara.*Public Trust \+1/ })).toHaveCount(1)
  for (const name of [/Solo/, /Hot-seat/, /easy/i, /normal/i, /hard/i, /The Ring/, /The Long Coast/, /The Delta/]) {
    await expect(page.getByRole('radio', { name })).toHaveCount(1)
  }

  // Tab to a control, then act on it with the keyboard.
  async function tabTo(test: (el: Element) => boolean, what: string) {
    for (let t = 0; t < 40; t++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(`(${test.toString()})(document.activeElement)`)) return
    }
    throw new Error(`never reached ${what}`)
  }
  // Swap Tomas for Sol: untick Tomas, tick Sol.
  await tabTo((el) => !!el.closest('[data-producer="tomas"]'), 'Tomas')
  await page.keyboard.press('Space')
  await tabTo((el) => !!el.closest('[data-producer="sol"]'), 'Sol')
  await page.keyboard.press('Space')
  await expect(page.getByRole('checkbox', { name: /Sol Abara/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Tomas Reed/ })).not.toBeChecked()
  // Hard: arrow along the difficulty radios.
  await tabTo((el) => !!el.closest('.setup-difficulty') && (el as HTMLInputElement).type === 'radio', 'difficulty')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: /hard/i })).toBeChecked()
  await tabTo((el) => el.classList.contains('setup-start'), 'Start')
  await page.keyboard.press('Enter')
  await page.locator('.game').waitFor()
})

// Plan item 188: on an upright phone Cath speaks her setup line: a 52 px+ bust left of the title and her bubble,
// the bubble's text 12 px+, neither box meeting the title.
// Plan item 349: she stands at half length in the stall header (item 188's bust grew), her line beside her.
test('Cath speaks her setup line from the stall beside it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the upright phone layout')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  const m = await page.evaluate(() => {
    const b = (q: string) => document.querySelector(q)!.getBoundingClientRect()
    return { cath: b('.setup-header-stand'), h1: b('.setup-header h1'), line: b('.setup-cath-line'), fs: parseFloat(getComputedStyle(document.querySelector('.setup-cath-line')!).fontSize) }
  })
  const s = JSON.stringify(m)
  expect(m.cath.height, s).toBeGreaterThanOrEqual(160)
  expect(m.cath.right, s).toBeLessThanOrEqual(m.line.left)
  expect(m.cath.right, s).toBeLessThanOrEqual(m.h1.left)
  expect(m.line.top, s).toBeGreaterThanOrEqual(m.h1.bottom - 1)
  expect(m.fs, s).toBeGreaterThanOrEqual(12)
})

// Plan item 349: one paper ground on a phone, no frames inside frames: every control has at most one bordered
// ancestor (the table, its sections and the mode pair lost their frames; a choice keeps its own edge).
test('the phone setup has no nested frames round its controls', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 600, 'an upright phone')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.locator('.setup').waitFor()
  const deep = await page.evaluate(() => {
    const bordered = (e: Element) => {
      const cs = getComputedStyle(e)
      return (['Top', 'Right', 'Bottom', 'Left'] as const).some((s) => parseFloat(cs.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 && cs.getPropertyValue(`border-${s.toLowerCase()}-style`) !== 'none')
    }
    return [...document.querySelectorAll('.setup button, .setup label, .setup input')]
      .filter((c) => c.getClientRects().length)
      .map((c) => {
        let n = 0
        for (let a = c.parentElement; a && a !== document.body; a = a.parentElement) if (bordered(a)) n++
        return { n, what: (c.textContent ?? '').trim().slice(0, 20) }
      })
      .filter((x) => x.n > 1)
  })
  expect(deep).toEqual([])
})

// Plan item 349: no word on the Setup under 12 px, at P and D.
test('the Setup prints nothing under 12 px', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  const small = await page.evaluate(() => {
    const out: string[] = []
    for (const e of document.querySelectorAll<HTMLElement>('main.setup *')) {
      if (e.closest('svg') || e.childElementCount > 0) continue
      const t = (e.textContent ?? '').trim()
      if (!/[A-Za-z0-9]/.test(t)) continue
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || e.getClientRects().length === 0) continue
      if (cs.position === 'absolute' && cs.width === '1px') continue
      if (parseFloat(cs.fontSize) < 12) out.push(`${t.slice(0, 24)} ${cs.fontSize}`)
    }
    return out
  })
  expect(small).toEqual([])
})
