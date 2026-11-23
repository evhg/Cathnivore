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
    expect(cath.height).toBeGreaterThanOrEqual(360)
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
