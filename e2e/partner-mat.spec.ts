import { test, expect } from '@playwright/test'

// Plan item 196: on a desktop the partner's farm is a small wooden mat under the active producer's card: their seat,
// three stores ([data-crate]: Produce, Marks, Goodwill) with counts at 12 px or more, and Improvement slots that fill
// with the cards they buy, all inside the Farm block (nothing scrolled out of sight).
test('the partner farm is a mat with three crates and slots', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'desktop rail only')
  test.setTimeout(120_000)
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=4')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const mat = page.locator('.farm-inline [data-partner-mat]')
  await expect(mat).toBeVisible()
  await expect(mat.locator('[data-crate]')).toHaveCount(3)
  await expect(mat.locator('.partner-slot:not(.partner-slot-more)')).toHaveCount(5)
  const check = async () => {
    const r = await page.evaluate(() => {
      const m = document.querySelector('.farm-inline [data-partner-mat]')!
      const farm = document.querySelector('.farm-inline')!.getBoundingClientRect()
      const b = m.getBoundingClientRect()
      const sizes = [...m.querySelectorAll('h3, .partner-mat-count, .farm-income')].map((e) => parseFloat(getComputedStyle(e).fontSize))
      return { top: b.top, bottom: b.bottom, farmTop: farm.top, farmBottom: farm.bottom, min: Math.min(...sizes) }
    })
    expect(r.min).toBeGreaterThanOrEqual(12)
    expect(r.top).toBeGreaterThanOrEqual(r.farmTop - 1)
    expect(r.bottom).toBeLessThanOrEqual(r.farmBottom + 1)
  }
  await check()
  // By round 4 the autoplayed partner has bought something: a slot holds the card.
  await page.waitForFunction(() => Number(document.querySelector('svg.map[data-round]')?.getAttribute('data-round') ?? 0) >= 4, null, { timeout: 90_000 })
  await page.waitForTimeout(1000)
  await check()
})

// Plan item 196: the ledger is a roll (an ol, [data-ledger]); plan item 244: its new lines are written in a 300 ms pen
// stroke, or only fade under reduced motion; Undo is a 'VOID' rubber stamp whose accessible name stays "Undo".
for (const reduced of [false, true]) {
  test(`the ledger is a receipt roll and Undo a void stamp${reduced ? ' (reduced motion)' : ''}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'desktop rail only')
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    const roll = page.locator('.actions-sheet [data-ledger]')
    await expect(roll).toBeVisible()
    expect(await roll.evaluate((e) => e.tagName)).toBe('OL')
    const anim = await roll.locator('.receipt').first().evaluate((e) => {
      const s = getComputedStyle(e)
      return { name: s.animationName, dur: parseFloat(s.animationDuration) }
    })
    expect(anim.dur).toBeLessThanOrEqual(0.3)
    expect(anim.name).toBe(reduced ? 'receipt-fade' : 'ink-stroke')
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    await expect(undo.locator('.rail-undo-void')).toBeVisible()
    expect(parseFloat(await undo.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12)
  })
}
