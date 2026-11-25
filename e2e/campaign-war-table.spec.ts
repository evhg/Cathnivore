import { expect, test } from '@playwright/test'

// Plan item 669: the desktop campaign is a war table with Cath at full presence: she is a half-length bust 360 px or
// more at 1440x900, the chapter ticket never covers a region's name, and pointing at another chapter changes her face.
const KEY = 'cathnivore:campaign:v1'
type Box = { left: number; top: number; right: number; bottom: number }
const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

for (const [w, h] of [
  [1440, 900],
  [1280, 800],
] as const) {
  test(`Cath at full presence and the ticket clear of every name at ${w}x${h}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
    await page.setViewportSize({ width: w, height: h })
    await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth', 'growing-season'], tutorialDone: true })), KEY)
    await page.goto('/')
    await page.getByRole('button', { name: 'Campaign' }).click()
    await page.mouse.move(4, h - 4)
    const cath = (await page.locator('.cmp-map-host .cmp-header-cath').boundingBox())!
    // plan item 696: a half-length bust 300 px or more in her own column (item 669's 360 px stood on the sheet)
    expect(cath.height).toBeGreaterThanOrEqual(300)
    // plan item 696: she hosts beside the atlas, never on it, and ends inside the window
    const map = (await page.locator('.campaign-screen > .cmp-map > .cmp-map-svg').boundingBox())!
    expect(cath.x).toBeGreaterThanOrEqual(map.x + map.width)
    expect(cath.y + cath.height).toBeLessThanOrEqual(h)
    expect(cath.x + cath.width).toBeLessThanOrEqual((await page.locator('.chapter-list').boundingBox())!.x)
    const line = (await page.locator('.cmp-map-host .cmp-cath-line').boundingBox())!
    expect(line.x).toBeGreaterThanOrEqual(map.x + map.width)
    // every chapter's ticket, in turn (pointed at from the bunting)
    const n = await page.locator('.cmp-pennant').count()
    for (let i = 0; i < n; i++) {
      await page.locator('.cmp-pennant').nth(i).hover()
      const id = (await page.locator('.cmp-pennant').nth(i).getAttribute('data-chapter'))!
      await expect(page.locator('.cmp-ticket')).toHaveAttribute('data-chapter', id)
      await page.waitForTimeout(350)
      const hit = await page.evaluate(() => {
        const t = document.querySelector('.cmp-ticket')!.getBoundingClientRect()
        return [...document.querySelectorAll('.cmp-map-name')]
          .map((e) => ({ name: e.textContent, r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.left < t.right && t.left < r.right && r.top < t.bottom && t.top < r.bottom)
          .map((x) => x.name)
      })
      expect(hit, id).toEqual([])
    }
    // the ticket stays off Cath's face
    const face = await page.evaluate(() => {
      const r = document.querySelector('.cmp-map-host .cath-features')!.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    })
    const t = await page.evaluate(() => {
      const r = document.querySelector('.cmp-ticket')!.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    })
    expect(meets(face, t)).toBe(false)
    // plan item 689: she stands out in the margin before the rail, her face centred past the sheet's east edge
    // less 20 px, so her hair clears Rivermead's east corner and the leaf by stop 4
    const sheetRight = await page.evaluate(() => document.querySelector('.campaign-screen > .cmp-map .cmp-sheet')!.getBoundingClientRect().right)
    expect((face.left + face.right) / 2).toBeGreaterThanOrEqual(sheetRight - 20)
  })
}

test('pointing at a won chapter, the next and a sealed one changes her face', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth'], tutorialDone: true })), KEY)
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  const fig = page.locator('.cmp-cath')
  const faceFor = async (chapter: string) => {
    await page.locator(`.cmp-pennant[data-chapter="${chapter}"]`).hover()
    await expect(fig).toHaveAttribute('data-chapter', chapter)
    return [await fig.getAttribute('data-state'), await fig.getAttribute('data-expression')]
  }
  const won = await faceFor('word-of-mouth')
  const next = await faceFor('growing-season')
  const sealed = await faceFor('the-plan')
  expect(won).toEqual(['done', 'delighted'])
  expect(next).toEqual(['current', 'determined'])
  expect(sealed).toEqual(['locked', 'wink'])
})

test('choosing a chapter unfolds its ticket from the pin in 400-600 ms; reduced motion fades it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })), KEY)
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.locator('.cmp-pennant[data-chapter="fresh-meat"]').hover()
  await expect(page.locator('.cmp-ticket')).toHaveAttribute('data-chapter', 'fresh-meat')
  const a = await page.locator('.cmp-ticket').evaluate((e) => ({ name: getComputedStyle(e).animationName, ms: parseFloat(getComputedStyle(e).animationDuration) * 1000 }))
  expect(a.name).toBe('cmp-ticket-unfold')
  expect(a.ms).toBeGreaterThanOrEqual(400)
  expect(a.ms).toBeLessThanOrEqual(600)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('.cmp-pennant[data-chapter="growing-season"]').hover()
  await expect(page.locator('.cmp-ticket')).toHaveAttribute('data-chapter', 'growing-season')
  expect(await page.locator('.cmp-ticket').evaluate((e) => getComputedStyle(e).animationName)).toBe('cmp-fade')
})

// Plan item 696: a locked chapter in the rail is a sealed envelope with its wax 24 px or more: the seal on a tall
// desktop's postcard print, the numbered seal on a short desktop's folded tab.
for (const [w, h] of [
  [1440, 900],
  [1280, 800],
] as const) {
  test(`locked chapters carry a 24 px seal at ${w}x${h}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
    await page.setViewportSize({ width: w, height: h })
    await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: [], tutorialDone: true })), KEY)
    await page.goto('/')
    await page.getByRole('button', { name: 'Campaign' }).click()
    const cards = page.locator('.cmp-stop-locked:not(.cmp-stop-next) .cmp-card')
    await expect(cards).toHaveCount(5)
    for (const card of await cards.all()) {
      const size = await card.evaluate((el) => {
        const seal = el.querySelector('.cmp-vignette.is-sealed .cmp-vig-seal')
        if (seal && seal.getBoundingClientRect().width > 0) return Math.min(seal.getBoundingClientRect().width, seal.getBoundingClientRect().height)
        const after = getComputedStyle(el, '::after')
        return after.content === 'none' ? 0 : Math.min(parseFloat(after.width), parseFloat(after.height))
      })
      expect(size).toBeGreaterThanOrEqual(24)
    }
  })
}
