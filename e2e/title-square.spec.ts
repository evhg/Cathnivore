import { expect, test, type Page } from '@playwright/test'

// Plan item 382: Marrow's market square stands behind the title's counter (ui/TitleSquare.tsx). The backdrop under
// the bunting is in colour, not a ghost (mean chroma of a 200x100 sample at least 45; it was about 25 before);
// the square's foot meets the table, never the footer; the menu and the board stay on top of it; at dusk a lamp
// behind Cath keeps her dark hair 3:1 against the square.

async function open(page: Page, hour: number, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme })
  await page.clock.setFixedTime(new Date(`2026-11-06T${String(hour).padStart(2, '0')}:30:00`))
  await page.goto('/')
  await page.locator('.title-cath svg').waitFor()
  await page.waitForTimeout(1800) // the title's fade-ins
}

/** Mean chroma (max-min of RGB) and mean relative luminance of each viewport rect, read from a screenshot. */
async function sample(page: Page, rects: [number, number, number, number][]) {
  const shot = (await page.screenshot()).toString('base64')
  return page.evaluate(
    async ({ shot, rects }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${shot}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const k = img.width / window.innerWidth
      const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return rects.map(([x, y, w, h]) => {
        const d = g.getImageData(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k)).data
        let chroma = 0
        let lum = 0
        for (let i = 0; i < d.length; i += 4) {
          chroma += Math.max(d[i]!, d[i + 1]!, d[i + 2]!) - Math.min(d[i]!, d[i + 1]!, d[i + 2]!)
          lum += 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!)
        }
        const n = d.length / 4
        return { chroma: chroma / n, lum: lum / n }
      })
    },
    { shot, rects },
  )
}

test('the square under the bunting is in colour, and the menu and board stand in front of it at 1440x900', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'D')
  await open(page, 11, 'light')
  const square = page.locator('.title-square')
  await expect(square).toBeVisible()
  await expect(square).toHaveAttribute('aria-hidden', 'true')
  const [left] = await sample(page, [[20, 250, 200, 100]])
  expect(left!.chroma, `chroma ${left!.chroma.toFixed(1)}`).toBeGreaterThanOrEqual(45)
  for (const sel of ['.title-menu', '.title-board']) {
    const b = (await page.locator(sel).boundingBox())!
    const onTop = await page.evaluate(
      ([x, y, sel]) => !!document.elementFromPoint(x as number, y as number)?.closest(sel as string),
      [b.x + b.width / 2, b.y + b.height / 2, sel] as const,
    )
    expect(onTop, `${sel} in front of the square`).toBe(true)
  }
})

test('the square stands on the table at every desktop size, not under the footer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'once, at several sizes')
  for (const [width, height] of [[1440, 900], [1280, 800], [1920, 1080]] as const) {
    await page.setViewportSize({ width, height })
    await open(page, 11, 'light')
    const sq = (await page.locator('.title-square').boundingBox())!
    const table = (await page.locator('.title-table-front').boundingBox())!
    const sky = (await page.locator('.title-sky').boundingBox())!
    expect(sq.y + sq.height, `${width}x${height}: the square's foot`).toBeLessThanOrEqual(table.y + 16)
    expect(sq.y + sq.height, `${width}x${height}: the square reaches the table`).toBeGreaterThanOrEqual(table.y - 2)
    expect(sq.y, `${width}x${height}: the square meets the street band`).toBeLessThanOrEqual(sky.y + sky.height)
    expect(sq.width).toBeLessThanOrEqual(width)
  }
})

test("at dusk a lamp behind Cath keeps her hair 3:1 against the square", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'D')
  await open(page, 11, 'dark')
  const svg = (await page.locator('.title-cath svg').boundingBox())!
  // her hair's fall at its left edge, and the square just right of it at the shoulder (between her and the board)
  const at = (fx: number, fy: number, w: number, h: number) => [svg.x + svg.width * fx, svg.y + svg.height * fy, w, h] as [number, number, number, number]
  const [hair, bg] = await sample(page, [at(0.295, 0.27, 10, 40), at(0.84, 0.22, 10, 40)])
  const ratio = (Math.max(hair!.lum, bg!.lum) + 0.05) / (Math.min(hair!.lum, bg!.lum) + 0.05)
  expect(ratio, `hair vs square ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
})

test('the phone title shows the square behind Cath and the board, with no sideways scroll', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'P')
  await open(page, 11, 'light')
  const sq = (await page.locator('.title-square').boundingBox())!
  const mark = (await page.locator('.title-wordmark').boundingBox())!
  expect(sq.y).toBeGreaterThanOrEqual(mark.y + mark.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  // the strip of square left of Cath, under her bubble
  const [band] = await sample(page, [[0, sq.y + 110, 34, 120]])
  expect(band!.chroma).toBeGreaterThanOrEqual(40)
})
