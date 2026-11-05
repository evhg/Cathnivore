import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 167: at 1440x900 the left rail is the active producer's player mat: a crate, coins and a rosette with
// their counts, what can't be played yet as a shelf of picture cards 80 px or wider, one visible portrait per
// producer (the bust at the table, not a second one in the rail), and nothing in the rail overlapping.
for (const scheme of ['light', 'dark'] as const) {
  test(`the rail is the producer's player mat at 1440x900 (${scheme})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only')
    await page.emulateMedia({ colorScheme: scheme })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.mouse.move(5, 5)

    const mat = page.locator('.desktop-col-left [data-player-mat]')
    await expect(mat).toBeVisible()
    await expect(mat.locator('.mat-store')).toHaveCount(3)
    await expect(mat.locator('.mat-art')).toHaveCount(3)
    // The counts are still the ledger's: Produce first.
    await expect(mat.locator('.ledger-value').first()).toHaveText(/^\d+$/)

    // The shelf: every 'Not yet' card is a picture card 80 px or wider.
    const later = page.locator('.actions-sheet .actions .action-head-later ~ .action-item')
    expect(await later.count()).toBeGreaterThan(0)
    const cards = await later.evaluateAll((els) =>
      els.map((e) => {
        const el = e as HTMLElement
        const pic = el.querySelector('.later-pic')
        const b = el.querySelector('button')!.getBoundingClientRect()
        // no line of the card's words runs past its edges
        const spill = [...el.querySelectorAll<HTMLElement>('.action-label, .action-why-not')].some((t) => { const r = t.getBoundingClientRect(); return r.left < b.left - 1 || r.right > b.right + 1 })
        return { name: el.textContent ?? '', w: el.offsetWidth, x: el.offsetLeft, y: el.offsetTop, h: el.offsetHeight, pic: !!pic && pic.getBoundingClientRect().height > 30, spill }
      }),
    )
    for (const c of cards) {
      expect(c.w, `${c.name} width`).toBeGreaterThanOrEqual(80)
      expect(c.pic, `${c.name} picture`).toBe(true)
      expect(c.spill, `${c.name} words run off the card`).toBe(false)
    }
    for (let i = 0; i < cards.length; i++)
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i]!, b = cards[j]!
        const meets = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(meets, `${a.name} / ${b.name} overlap`).toBe(false)
      }

    // One visible portrait per producer: the rail drops its seat while the producer sits at the table.
    const faces = await page.evaluate(() => {
      const seen: Record<string, number> = {}
      for (const el of document.querySelectorAll<HTMLElement>('.producer-seat, .producer-cameo, .table-producer')) {
        const r = el.getBoundingClientRect()
        if (r.width < 4 || r.height < 4 || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue
        if (el.closest('[hidden], .visually-hidden')) continue
        const id = [...el.classList].find((c) => c.startsWith('pc-'))?.slice(3)
        if (id) seen[id] = (seen[id] ?? 0) + 1
      }
      return seen
    })
    for (const [id, n] of Object.entries(faces)) expect(n, `${id} portraits`).toBe(1)

    // Nothing in the rail overlaps: the producer frame and the Actions frame, and the mat sits inside its frame.
    const boxes = await page.evaluate(() =>
      ['.desktop-col-left .producer-sheet', '.desktop-col-left .actions-sheet', '.desktop-col-left [data-player-mat]'].map((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
      }),
    )
    const [sheet, actions, matBox] = boxes as [typeof boxes[0], typeof boxes[0], typeof boxes[0]]
    expect(sheet.bottom).toBeLessThanOrEqual(actions.top + 0.5)
    expect(matBox.left).toBeGreaterThanOrEqual(sheet.left)
    expect(matBox.right).toBeLessThanOrEqual(sheet.right)
    expect(matBox.bottom).toBeLessThanOrEqual(sheet.bottom)
    const stores = await mat.locator('.mat-store').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right] }))
    for (const [l, r] of stores) {
      expect(l!).toBeGreaterThanOrEqual(matBox.left)
      expect(r!).toBeLessThanOrEqual(matBox.right + 0.5)
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900)
  })
}
