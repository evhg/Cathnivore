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
    // Plan item 436: the week's poster is held out at her side: 80%+ of her figure (to the counter) stands clear of it.
    const flyer = (await page.locator('.market-event[data-flyer]').boundingBox())!
    const ox = Math.max(0, Math.min(cath.x + cath.width, flyer.x + flyer.width) - Math.max(cath.x, flyer.x))
    const oy = Math.max(0, Math.min(figBottom, flyer.y + flyer.height) - Math.max(cath.y, flyer.y))
    expect((ox * oy) / (cath.width * (figBottom - cath.y)), 'poster over her figure').toBeLessThanOrEqual(0.2)
    // Plan item 643: from 1280 px the card hangs on the stall's left post, meeting no part of her drawn figure (the
    // union of her art's shapes) nor the board's hexes.
    if (width >= 1280) {
      const clear = await page.evaluate(() => {
        const f = document.querySelector('.market-event[data-flyer]')!.getBoundingClientRect()
        let left = Infinity
        for (const e of document.querySelectorAll('.setup-cath-stand .cath-art svg :is(path, ellipse, circle, rect, polygon)')) {
          const r = e.getBoundingClientRect()
          if (r.width > 0 && r.top < f.bottom && f.top < r.bottom) left = Math.min(left, r.left)
        }
        let hexRight = 0
        for (const h of document.querySelectorAll('[data-setup-table] polygon')) {
          const r = h.getBoundingClientRect()
          if (r.top < f.bottom && f.top < r.bottom && r.left < f.left) hexRight = Math.max(hexRight, r.right)
        }
        return { cath: left - f.right, hexes: f.left - hexRight }
      })
      expect(clear.cath, 'the week card meets her figure').toBeGreaterThanOrEqual(0)
      expect(clear.hexes, 'the week card meets a hex').toBeGreaterThanOrEqual(0)
    }
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
    // Plan item 598: her column's top is her stall's awning and board, not empty cream above her quote.
    const top = await page.locator('.setup-cath-stand').evaluate((e) => ({ awning: getComputedStyle(e, '::before').height, sign: getComputedStyle(e, '::after').content }))
    expect(parseFloat(top.awning)).toBeGreaterThanOrEqual(40)
    expect(top.sign).toContain('stall')
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  })
}
