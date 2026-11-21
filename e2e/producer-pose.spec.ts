import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 594: the producers act on stage. When a beat of theirs resolves they step up into a pose drawn by their
// Figure (a raised finger for their own ability, a fist up for a gain, a slump under a Squeeze on their Stall) at once,
// and their reply follows in their own bubble; at a desktop table both figures stand wholly inside the table's frame.
async function start(page: Page) {
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game svg.map')).toBeVisible()
  // let the deal's own beat (round 1's pair opener) speak first
  await page.waitForTimeout(2500)
}

/** The drawn parts of each seated figure (head, the sleeves showing, a raised arm), against the table's frame. */
async function inFrame(page: Page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('.map-wrap')!.getBoundingClientRect()
    return [...document.querySelectorAll('.map-wrap [data-table-producer]:not([data-unseated])')].flatMap((p) =>
      [...p.querySelectorAll('.fig-head, .fig-body > path:not(.fig-arm-off), .fig-pose-arm')].map((e) => {
        const r = e.getBoundingClientRect()
        // (a sleeve's path runs past the figure's foot, where the svg clips it at the rim: the bottom is the svg's)
        const foot = Math.min(r.bottom, p.querySelector('svg.fig')!.getBoundingClientRect().bottom)
        const inside = r.left >= wrap.left - 0.5 && r.right <= wrap.right + 0.5 && r.top >= wrap.top - 0.5 && foot <= wrap.bottom + 0.5
        return { who: `${p.getAttribute('data-table-producer')} ${e.getAttribute('class')} ${[r.left, r.top, r.right, foot].map(Math.round)} in ${[wrap.left, wrap.top, wrap.right, wrap.bottom].map(Math.round)}`, inside }
      }),
    )
  })
}

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`a producer's power: they step up and point within 250 ms, then speak (${width}x${height})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop table')
    await page.setViewportSize({ width, height })
    await start(page)
    for (const part of await inFrame(page)) expect(part.inside, `${part.who} inside the frame at rest`).toBe(true)
    const card = page.getByRole('button', { name: /Injunction/ }).first()
    test.skip(!(await card.isVisible().catch(() => false)), 'Mara does not open this seat')
    const before = await page.locator('[data-table-producer="mara"]').getAttribute('data-pose')
    expect(before).toBeNull()
    await card.click()
    const t0 = Date.now()
    const pick = page.locator('.region-hex-selectable.glow').first()
    if (await pick.isVisible({ timeout: 300 }).catch(() => false)) await pick.click()
    await expect(page.locator('[data-table-producer="mara"][data-pose="point"] svg.fig[data-pose="point"] .fig-pose-arm')).toHaveCount(1, { timeout: 250 })
    expect(Date.now() - t0).toBeLessThan(1000)
    // her reply, in her own bubble at her seat
    await expect(page.locator('[data-table-producer="mara"] [data-producer-line][data-beat=ability]')).toBeVisible({ timeout: 2500 })
    await page.waitForTimeout(400)
    for (const part of await inFrame(page)) expect(part.inside, `${part.who} inside the frame, posed`).toBe(true)
    // the pose is held while she speaks, then she steps back
    await expect(page.locator('[data-table-producer][data-pose]')).toHaveCount(0, { timeout: 6000 })
  })
}

test('the seated producers cheer at a liberation and slump under a Squeeze (each Figure draws all three: tests/producer-mood)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop table')
  await page.setViewportSize({ width: 1440, height: 900 })
  await start(page)
  const ids = await page.evaluate(() => [...document.querySelectorAll('.game .region-hex')].map((h) => h.getAttribute('data-region')!))
  const seen: Record<string, Set<string>> = {}
  const note = async () => {
    for (const [who, pose] of await page.evaluate(() => [...document.querySelectorAll('[data-table-producer][data-pose]')].map((e) => [e.getAttribute('data-table-producer')!, e.getAttribute('data-pose')!] as const)))
      (seen[who] ??= new Set()).add(pose)
  }
  await page.evaluate(() => (window as unknown as { cathnivoreMoment(k: string, r: string): void }).cathnivoreMoment('liberate', 'kingsmarket'))
  await expect(page.locator('[data-table-producer][data-pose="cheer"]')).toHaveCount(1, { timeout: 250 })
  await note()
  for (const r of ids) {
    await page.evaluate((r) => (window as unknown as { cathnivoreMoment(k: string, r: string): void }).cathnivoreMoment('squeeze', r), r)
    await page.waitForTimeout(60)
    if (await page.locator('[data-table-producer][data-pose="slump"]').count()) break
  }
  await note()
  expect(Object.values(seen).flatMap((s) => [...s]).sort()).toEqual(expect.arrayContaining(['cheer', 'slump']))
})

test('under reduced motion a pose only fades in', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one size is enough')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await start(page)
  await page.evaluate(() => (window as unknown as { cathnivoreMoment(k: string, r: string): void }).cathnivoreMoment('liberate', 'kingsmarket'))
  const posed = page.locator('[data-table-producer][data-pose="cheer"]')
  await expect(posed).toHaveCount(1, { timeout: 250 })
  const m = await posed.evaluate((p) => {
    const svg = p.querySelector('svg.fig')!
    return { translate: getComputedStyle(svg).translate, anim: getComputedStyle(p.querySelector('.fig-pose-arm')!).animationName, head: getComputedStyle(p.querySelector('.fig-head')!).transform }
  })
  expect(m.translate).toBe('none')
  expect(m.anim).toBe('pose-arm-fade')
  expect(m.head).toBe('none')
})
