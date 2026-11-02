import { expect, test } from '@playwright/test'

// Plan item 39: Practice is one screen (the board under one "Board" chip whose sheet holds size, codes, picks and
// the workshop), and the first-visit lesson hides the stats rail.

const tileBox = () => {
  const boxes = [...document.querySelectorAll('#board .tile')].map((t) => t.getBoundingClientRect())
  return {
    top: Math.min(...boxes.map((b) => b.top)),
    width: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left)),
  }
}

test.describe('Runnel Practice on one screen (plan item 39)', () => {
  test('at 390x844 the Practice board starts within 260 px of the top and fills 85% of the width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/runnel/?nohelp&mode=practice')
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    await expect(page.locator('#btn-board')).toBeVisible()
    await expect(page.locator('#sizes')).toBeHidden()
    await expect(page.locator('#code-input')).toBeHidden()
    const svgTop = await page.locator('#board').evaluate((b) => b.getBoundingClientRect().top)
    expect(svgTop).toBeLessThanOrEqual(260)
    const r = await page.evaluate(tileBox)
    expect(r.width / 390).toBeGreaterThanOrEqual(0.85)
    // Nothing scrolls sideways or down: the screen holds the whole board and its buttons.
    const over = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }))
    expect(over.x).toBeLessThanOrEqual(0)
    expect(over.y).toBeLessThanOrEqual(0)
  })

  test('the Board chip opens a sheet: a size change closes it and plays that size', async ({ page }) => {
    await page.goto('/runnel/?nohelp&mode=practice')
    await expect(page.locator('#board-chip-label')).toHaveText('Medium')
    const medium = await page.locator('.tiles > g.cell').count()
    await page.locator('#btn-board').click()
    await expect(page.locator('#board-sheet')).toBeVisible()
    await page.locator('#board-sheet').getByRole('button', { name: 'Large' }).click()
    await expect(page.locator('#board-sheet')).toBeHidden()
    await expect(page.locator('#board-chip-label')).toHaveText('Large')
    expect(await page.locator('.tiles > g.cell').count()).toBeGreaterThan(medium)
    await page.locator('#btn-board').click()
    await page.locator('#board-sheet-close').click()
    await expect(page.locator('#board-sheet')).toBeHidden()
  })

  test('the chip only shows in Practice', async ({ page }) => {
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('#btn-board')).toBeHidden()
    await page.getByRole('tab', { name: 'Practice' }).click()
    await expect(page.locator('#btn-board')).toBeVisible()
    await page.getByRole('tab', { name: 'Orchard' }).click()
    await expect(page.locator('#btn-board')).toBeHidden()
  })

  test('the stats rail is hidden during the lesson at 1440', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'the rail is a desktop layout')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/runnel/?lesson')
    await expect(page.locator('body.in-lesson')).toHaveCount(1)
    await expect(page.locator('#rail')).toBeHidden()
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('#rail')).toBeVisible()
  })
})

test.describe("Bea's workshop (plan item 39)", () => {
  test('build a board, test it, solve it and share it; the pasted code plays the same board', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/runnel/?nohelp&mode=practice')
    await page.locator('#btn-board').click()
    await page.locator('#btn-workshop').click()
    const ws = page.locator('#workshop')
    await expect(ws).toBeVisible()
    // The workshop fills the screen.
    const vp = page.viewportSize()!
    // (after its 280 ms opening scale)
    await expect.poll(async () => (await ws.boundingBox())!.width).toBeGreaterThanOrEqual(vp.width - 1)
    expect((await ws.boundingBox())!.height).toBeGreaterThanOrEqual(vp.height - 1)
    await expect(page.locator('#ws-share')).toBeDisabled()

    // Draw spring -> R1 -> R2 -> the tile below-left of R2 on the small board.
    const centres = await page.locator('#ws-board g[data-cell]').evaluateAll((gs) =>
      gs.map((g) => {
        const r = g.getBoundingClientRect()
        return { i: Number((g as SVGGElement).dataset.cell), x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }
      }),
    )
    const near = (x: number, y: number) => centres.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a))
    const svg = (await page.locator('#ws-board').boundingBox())!
    const mid = near(svg.x + svg.width / 2, svg.y + svg.height / 2)
    const w = mid.w
    const r1 = near(mid.x + w, mid.y)
    const r2 = near(mid.x + 2 * w, mid.y)
    const bl = near(r2.x - w / 2, r2.y + w * 0.87)
    for (const c of [mid, r1, r2, bl]) await page.locator(`#ws-board g[data-cell="${c.i}"]`).click()
    await expect(page.locator('#ws-board .ws-water')).not.toHaveCount(0)
    await expect(page.locator('#ws-play')).toBeEnabled()
    await expect(page.locator('#ws-share')).toBeDisabled()

    await page.locator('#ws-play').click()
    await expect(ws).toBeHidden()
    const shape = () =>
      page.locator('#board .tiles').evaluate((t) => [...t.querySelectorAll(':scope > g.cell')].map((g) => `${g.getAttribute('transform')}|${g.getAttribute('class')}`).join(';'))
    const before = await shape()
    // Solve it: the test hook leaves one tile a tap away.
    await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
    await page.locator('#board [data-last]').click()
    await expect(page.locator('#dlg-win')).toBeVisible()
    await expect(page.locator('#win-eyebrow')).toHaveText("Made in Bea's workshop")
    const code = (await page.locator('#win-note').textContent())!.match(/W2-[A-Za-z0-9_-]+/)![0]
    await page.locator('#btn-next').click()
    await expect(ws).toBeVisible()
    await expect(page.locator('#ws-share')).toBeEnabled()
    await expect(page.locator('#ws-shelf .ws-pick').first()).toHaveText(code)
    await page.locator('#ws-share').click()
    await expect(page.locator('#ws-status')).toContainText(code)
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain(code)
    await page.locator('#ws-close').click()

    // Paste the code into a fresh profile's Practice: the same board comes up.
    await page.evaluate(() => localStorage.clear())
    await page.goto('/runnel/?nohelp&mode=practice')
    await page.locator('#btn-board').click()
    await page.locator('#code-input').fill(code)
    await page.locator('#codebar button[type=submit]').click()
    await expect(page.locator('#board-sheet')).toBeHidden()
    expect(await shape()).toBe(before)
  })
})
