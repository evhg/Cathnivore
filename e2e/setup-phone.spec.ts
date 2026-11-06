import { expect, test, type Locator, type Page } from '@playwright/test'

// Plan item 54: the phone Setup deals you in. At 390x844 every control is on screen with no page scroll, and the
// two picked producers' abilities read in full. Setup also works from the keyboard alone, and every card has a name.

async function inView(page: Page, el: Locator, what: string) {
  const vh = page.viewportSize()!.height
  const b = (await el.boundingBox())!
  expect(b, what).not.toBeNull()
  expect(b.y, `${what} top`).toBeGreaterThanOrEqual(0)
  expect(b.y + b.height, `${what} bottom`).toBeLessThanOrEqual(vh + 0.5)
}

test('every Setup control is on a phone screen with no scroll, the pair read in full', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the upright phone layout')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)

  // Pick Ines and Sol (cards 3 and 4), so the picked pair isn't simply the first two.
  await page.locator('.producer-card', { hasText: 'Mara Keel' }).click()
  await page.locator('.producer-card', { hasText: 'Tomas Reed' }).click()
  await page.locator('.producer-card', { hasText: 'Ines Farrow' }).click()
  await page.locator('.producer-card', { hasText: 'Sol Abara' }).click()
  await expect(page.locator('.producer-card input:checked')).toHaveCount(2)

  const controls: Array<[Locator, string]> = [
    ...(await page.locator('.producer-card').all()).map((c, i) => [c, `producer ${i + 1}`] as [Locator, string]),
    ...(await page.locator('.setup-mode label').all()).map((c, i) => [c, `mode ${i + 1}`] as [Locator, string]),
    ...(await page.locator('.setup-difficulty label').all()).map((c, i) => [c, `difficulty ${i + 1}`] as [Locator, string]),
    ...(await page.locator('.layout-tile').all()).map((c, i) => [c, `map ${i + 1}`] as [Locator, string]),
    [page.getByRole('button', { name: 'Advanced' }), 'Advanced'],
    [page.getByRole('button', { name: 'Start' }), 'Start'],
  ]
  expect(controls.length).toBe(4 + 2 + 3 + 3 + 2)
  for (const [el, what] of controls) await inView(page, el, what)

  // The picked pair's abilities, in full: on screen and not clipped by their box.
  const abilities = page.locator('.pair-ability')
  await expect(abilities).toHaveCount(2)
  await expect(abilities.nth(0)).toContainText('Remove 1 Doubt from a region with your Stall, at no cost.')
  await expect(abilities.nth(1)).toContainText('Public Trust +1, or gain 2 Goodwill.')
  for (const i of [0, 1]) {
    await inView(page, abilities.nth(i), `ability ${i + 1}`)
    expect(await abilities.nth(i).evaluate((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await expect(page.locator('.pair-line')).toContainText('Doubt cleared')

  // Every difficulty still fits with no scroll; Advanced opens the seed.
  for (const i of [0, 2, 1]) {
    await page.locator('.setup-difficulty label').nth(i).click()
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  }
  await expect(page.locator('input[inputmode="numeric"]')).toBeHidden()
  await page.getByRole('button', { name: 'Advanced' }).click()
  await expect(page.locator('input[inputmode="numeric"]')).toBeVisible()
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
test('Cath speaks her setup line from a bust beside it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the upright phone layout')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  const m = await page.evaluate(() => {
    const b = (q: string) => document.querySelector(q)!.getBoundingClientRect()
    return { cath: b('.setup-header-cath'), h1: b('.setup-header h1'), line: b('.setup-cath-line'), fs: parseFloat(getComputedStyle(document.querySelector('.setup-cath-line')!).fontSize) }
  })
  const s = JSON.stringify(m)
  expect(m.cath.height, s).toBeGreaterThanOrEqual(52)
  expect(m.cath.right, s).toBeLessThanOrEqual(m.line.left)
  expect(m.cath.right, s).toBeLessThanOrEqual(m.h1.left)
  expect(m.line.top, s).toBeGreaterThanOrEqual(m.h1.bottom - 1)
  expect(m.fs, s).toBeGreaterThanOrEqual(12)
})
