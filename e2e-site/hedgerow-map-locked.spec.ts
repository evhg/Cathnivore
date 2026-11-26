import { expect, test, type Page } from '@playwright/test'

// Plan item 702: a locked stop is drained of colour (its landmark's mean saturation under 0.15 as drawn, where a won
// stop's is well over it) and Hollowell's tag is a padlock (a shackle drawn over the tag).
const saturation = async (page: Page, png: Buffer) =>
  page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const x = c.getContext('2d')!
    x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    let sum = 0
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, bl] = [d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255]
      const max = Math.max(r, g, bl)
      const min = Math.min(r, g, bl)
      const l = (max + min) / 2
      if (l < 0.08 || l > 0.94) continue // ink lines and paper highlights carry no hue
      sum += (max - min) / (1 - Math.abs(2 * l - 1))
      n++
    }
    return n ? sum / n : 0
  }, png.toString('base64'))

test('a locked stop is drained of colour and padlocked', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    const seenBefore: Record<string, boolean> = {}
    for (let i = 1; i <= 13; i++) {
      stars[i] = 3
      seenBefore[i] = true
    }
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: { all: true }, bank: {} }))
    localStorage.setItem('hedgerow:fog:v1', '2')
  })
  await page.goto('/hedgerow/?2d')
  const locked = page.locator('#screen-select .node:disabled[data-level="17"] .level-landmark')
  const won = page.locator('#screen-select .node.cleared[data-level="12"] .level-landmark')
  await locked.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  const sLocked = await saturation(page, await locked.screenshot())
  await won.scrollIntoViewIfNeeded()
  const sWon = await saturation(page, await won.screenshot())
  expect(sLocked, `locked ${sLocked.toFixed(3)}, won ${sWon.toFixed(3)}`).toBeLessThan(0.15)
  expect(sWon, 'a won stop keeps its colour').toBeGreaterThan(0.25)
  const shackle = await page.locator('#screen-select .node:disabled[data-level="17"] .level-n').evaluate((e) => {
    const a = getComputedStyle(e, '::after')
    return a.content !== 'none' && parseFloat(a.width) >= 8 && a.borderTopStyle === 'solid'
  })
  expect(shackle, "Hollowell's tag wears a padlock shackle").toBe(true)
})

// Plan item 702: no haze over a stop or its name above 0.15: the locked stops' mist banks (0.82 before, stacking into
// a white column down a phone's map) peak at 0.15 or less.
test("a locked stop's mist is a breath, 0.15 or less", async ({ page }) => {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i <= 30; i++) stars[i] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true, 27: true }, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?2d')
  const stop = page.locator('#screen-select .stop:has(> .node:disabled[data-level="33"])')
  await stop.scrollIntoViewIfNeeded()
  const bg = await stop.evaluate((e) => getComputedStyle(e, '::before').backgroundImage)
  const alphas = [...bg.matchAll(/\/ ([\d.]+)\)/g)].map((m) => Number(m[1]))
  expect(alphas.length, bg).toBeGreaterThan(0)
  expect(Math.max(...alphas), bg).toBeLessThanOrEqual(0.15)
})
