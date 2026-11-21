import { expect, test, type Page } from '@playwright/test'

// Plan item 597: the first lesson leaves the valley in its season's colours (item 229's dim laid a grey-mauve wash over
// the first screen a player sees). Measured beside the tiles: the lesson's valley is no darker than a daily's under the
// same sky, and the tiles' dark rim still stands off it.

async function valleyLuma(page: Page, near = true) {
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' })
  await page.waitForTimeout(300)
  const png = (await page.screenshot()).toString('base64')
  return page.evaluate(async ([s, near]) => {
    const i = new Image()
    i.src = `data:image/png;base64,${s}`
    await i.decode()
    const c = document.createElement('canvas')
    c.width = i.width
    c.height = i.height
    const x = c.getContext('2d')!
    x.drawImage(i, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    const sx = c.width / innerWidth
    const v = document.querySelector('svg.valley')!.getBoundingClientRect()
    const bd = document.querySelector('#board .tiles')!.getBoundingClientRect()
    const skip = [...document.querySelectorAll('.valley-cath, .valley-say')].map((e) => e.getBoundingClientRect()).filter((q) => q.width > 0)
    const lin = (u: number) => ((u /= 255) <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4)
    let sum = 0
    let n = 0
    // a daily's board fills the valley at D: it is read everywhere off the tiles' box
    const far = near ? (innerWidth < 600 ? 40 : 80) : 0
    for (let y = Math.ceil(v.top) + 4; y < v.bottom - 4; y += 3)
      for (let X = Math.ceil(v.left) + 4; X < v.right - 4; X += 3) {
        const dx = Math.max(bd.left - X, 0, X - bd.right)
        const dy = Math.max(bd.top - y, 0, y - bd.bottom)
        if (Math.hypot(dx, dy) < far) continue
        if (skip.some((q) => X >= q.left && X <= q.right && y >= q.top && y <= q.bottom)) continue
        const k = (Math.round(y * sx) * c.width + Math.round(X * sx)) * 4
        sum += 0.2126 * lin(d[k]!) + 0.7152 * lin(d[k + 1]!) + 0.0722 * lin(d[k + 2]!)
        n++
      }
    return { luma: sum / n, n }
  }, [png, near] as const)
}

for (const [name, size] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]] as const) {
  test(`the lesson's valley keeps its colours: no darker than a daily's (${name})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'site-desktop', 'sets its own viewport; one run is enough')
    await page.setViewportSize(size)
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.clock.setFixedTime(new Date('2026-11-21T10:00:00Z'))
    await page.goto('/runnel/?sky=dusk,clear')
    await expect(page.locator('body.in-lesson')).toHaveCount(1)
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    const lesson = await valleyLuma(page)
    await page.goto('/runnel/?nohelp&sky=dusk,clear')
    await expect(page.locator('body.in-lesson')).toHaveCount(0)
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    const daily = await valleyLuma(page, false)
    expect(daily.n).toBeGreaterThan(200)
    expect(lesson.n).toBeGreaterThan(500)
    expect(lesson.luma, `lesson ${lesson.luma.toFixed(3)} vs daily ${daily.luma.toFixed(3)}`).toBeGreaterThanOrEqual(daily.luma)
  })
}
