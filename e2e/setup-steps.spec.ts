import { expect, test } from '@playwright/test'

// Plan item 367: at D Quick Game is one table in three numbered steps (who, where, how hard), headed by numerals and
// words with no pill-tag labels; Cath stands 300 px+ behind a counter on the right with the week's poster, her bubble
// carrying the event and her advice; Start sits on the counter clear of her; every text is 13 px or more; no scroll.
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`desktop Setup at ${width}x${height}: three steps, Cath behind the counter`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the desktop table')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    const steps = page.locator('[data-setup-table] .setup-step')
    await expect(steps).toHaveCount(3)
    await expect(page.locator('.step-head .step-num')).toHaveText(['1', '2', '3'])
    // The old uppercase section labels are not drawn.
    const pills = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main.setup h2')]
        .filter((h) => !h.closest('.market-event') && !h.classList.contains('step-head'))
        .filter((h) => { const r = h.getBoundingClientRect(); return r.width > 2 && r.height > 2 })
        .map((h) => h.textContent),
    )
    expect(pills).toEqual([])
    // Cath 300 px+, Start clear of her figure.
    const cath = (await page.locator('.setup-cath-stand .cath-art svg').boundingBox())!
    const stand = (await page.locator('.setup-cath-stand').boundingBox())!
    const start = (await page.locator('.setup-start').boundingBox())!
    expect(cath.height).toBeGreaterThanOrEqual(300)
    const figBottom = Math.min(cath.y + cath.height, stand.y + stand.height)
    expect(start.y).toBeGreaterThanOrEqual(figBottom)
    // Her bubble carries the week's event and her pick advice.
    await expect(page.locator('.setup-cath-says .says-event')).toBeVisible()
    await expect(page.locator('.setup-cath-says .says-pick')).toBeVisible()
    // The seed waits behind Advanced.
    await expect(page.locator('.setup-seed-field input')).toBeHidden()
    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.locator('.setup-seed-field input')).toBeVisible()
    // Every text 13 px or more, and no scroll.
    const small = await page.evaluate(() => {
      const out: string[] = []
      const walk = document.createTreeWalker(document.querySelector('main.setup')!, NodeFilter.SHOW_TEXT)
      while (walk.nextNode()) {
        const t = walk.currentNode as Text
        const el = t.parentElement!
        if (!t.textContent!.trim()) continue
        const r = el.getBoundingClientRect()
        const h2 = el.closest('h2')
        const hb = h2?.getBoundingClientRect()
        if (r.width < 2 || r.height < 2 || el.closest('svg') || (hb && (hb.width < 2 || hb.height < 2))) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.fontSize === '0px') continue
        if (parseFloat(cs.fontSize) < 12.95) out.push(`${el.className}: ${cs.fontSize} '${t.textContent!.trim().slice(0, 20)}'`)
      }
      return out
    })
    expect(small).toEqual([])
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  })
}
