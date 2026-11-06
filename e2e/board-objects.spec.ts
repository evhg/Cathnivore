import { test, expect } from '@playwright/test'

// Plan item 184: the Market Board's readings are objects on the table (a chalk slate, a jar of tokens, a stack of
// deeds, a cracking plate). Each [data-meter] keeps a 16 px+ figure and an aria label; the strip stays short and
// clear of the corp cards and the menu key; changes are staged in 250-600 ms, a fade under reduced motion.
for (const reduced of [false, true]) {
  test(`the scoreboard is four objects on the table${reduced ? ' (reduced motion)' : ''}`, async ({ page, isMobile }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=3')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    const board = page.locator('.market-board')
    await expect(board.locator('[data-meter="round"] .board-num')).toHaveText(/^3\//, { timeout: 30_000 })

    for (const [meter, object, label] of [['round', 'slate', /^Round 3 of \d+$/], ['trust', 'jar', /^Public Trust \d+ of 15$/], ['land', 'deeds', /^Land left \d+ of \d+$/], ['rift', 'plate', /^Rift \d of 6$/]] as const) {
      const cell = board.locator(`[data-meter="${meter}"]`)
      await expect(cell).toHaveAttribute('aria-label', label)
      await expect(cell.locator(`svg[data-object="${object}"]`)).toBeVisible()
      const num = cell.locator('.board-num')
      expect(parseFloat(await num.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16)
    }
    await expect(board.locator('.meter')).toHaveCount(0)

    const m = await page.evaluate(() => {
      const r = (e: Element) => e.getBoundingClientRect()
      const meet = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
      const strip = r(document.querySelector('.market-board')!)
      const menu = r(document.querySelector('.board-menu')!)
      const cells = [...document.querySelectorAll('[data-meter]')].map(r)
      const corp = [...document.querySelectorAll('.plan-strip-item')].map(r).filter((b) => b.width > 0)
      return { h: strip.height, cellsMenu: cells.some((c) => meet(c, menu)), stripCorp: corp.some((c) => meet(strip, c)), corp: corp.length }
    })
    expect(m.h).toBeLessThanOrEqual(isMobile ? 52 : 72)
    expect(m.cellsMenu).toBe(false)
    expect(m.corp).toBeGreaterThan(0)
    expect(m.stripCorp).toBe(false)

    // The round's newest tally was chalked on as round 3 began.
    const anim = await board.locator('.bo-tally.bo-new').last().evaluate((e) => ({ name: getComputedStyle(e).animationName, ms: parseFloat(getComputedStyle(e).animationDuration) * 1000 }))
    expect(anim.name).toBe(reduced ? 'bo-fade' : 'bo-draw')
    expect(anim.ms).toBeGreaterThanOrEqual(250)
    expect(anim.ms).toBeLessThanOrEqual(600)
  })
}
