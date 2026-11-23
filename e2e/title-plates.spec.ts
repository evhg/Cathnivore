import { expect, test } from '@playwright/test'

// Plan item 671: the phone title is one composition. Cath's face stays clear of the board, the seven regions keep
// short name plates (no two touching, each inside the board), and on the day's opening the board deals its pieces
// in over 400 ms or more; reduced motion gets the opening's fade instead.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the upright phone')
  await page.setViewportSize({ width: 390, height: 844 })
})

type Box = { x: number; y: number; width: number; height: number }
const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test('Cath\'s face is clear of the board and all seven regions wear a readable plate', async ({ page }) => {
  await page.goto('/')
  await page.locator('.title-cath svg').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  const face = (await page.locator('.title-cath .cath-features').first().boundingBox())!
  const board = (await page.locator('.title-board .map').boundingBox())!
  expect(meets(face, board)).toBe(false)
  const signs = await page.evaluate(() =>
    [...document.querySelectorAll<SVGGElement>('.title-board .region-sign')].map((g) => {
      const name = g.querySelector<SVGTextElement>('.region-name')!
      const plate = g.querySelector('.region-plaque')!.getBoundingClientRect()
      const disc = g.querySelector('.region-status')?.getBoundingClientRect()
      return {
        text: name.textContent,
        shown: getComputedStyle(name).display !== 'none' && name.getBoundingClientRect().width > 0,
        px: parseFloat(getComputedStyle(name).fontSize) * (name.getScreenCTM()?.a ?? 1),
        plate: { x: plate.x, y: plate.y, width: plate.width, height: plate.height },
        disc: disc ? { x: disc.x, y: disc.y, width: disc.width, height: disc.height } : null,
      }
    }),
  )
  expect(signs.map((s) => s.text).sort()).toEqual(['Brindle', 'Kings', 'Moor', 'Oak', 'River', 'Salt', 'Shingle'])
  for (const s of signs) {
    expect(s.shown, s.text!).toBe(true)
    expect(s.px, s.text!).toBeGreaterThanOrEqual(11.95)
    // inside the board, the status disc too
    for (const b of [s.plate, s.disc].filter(Boolean) as Box[]) {
      expect(b.x, s.text!).toBeGreaterThanOrEqual(board.x - 1)
      expect(b.x + b.width, s.text!).toBeLessThanOrEqual(board.x + board.width + 1)
    }
  }
  for (let i = 0; i < signs.length; i++)
    for (let j = i + 1; j < signs.length; j++) {
      const a = signs[i]!
      const b = signs[j]!
      for (const x of [a.plate, a.disc]) for (const y of [b.plate, b.disc]) if (x && y) expect(meets(x, y), `${a.text} / ${b.text}`).toBe(false)
    }
})

test('the opening deals the board in over 400 ms or more; reduced motion fades', async ({ page }) => {
  await page.goto('/?opening')
  await page.locator('.title-cath svg').waitFor()
  const deal = await page.evaluate(() => {
    const parts = [...document.querySelectorAll('.title-board .piece-tray, .title-board .region-sign')]
    const timings = parts.map((e) => {
      const cs = getComputedStyle(e)
      return { name: cs.animationName, end: (parseFloat(cs.animationDelay) + parseFloat(cs.animationDuration)) * 1000 }
    })
    return { names: [...new Set(timings.map((t) => t.name))].sort(), end: Math.max(...timings.map((t) => t.end)), n: parts.length }
  })
  expect(deal.n).toBeGreaterThanOrEqual(14)
  expect(deal.names).toEqual(['title-piece-deal', 'title-plate-deal'])
  expect(deal.end).toBeGreaterThanOrEqual(400)
  expect(deal.end).toBeLessThanOrEqual(1200)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?opening')
  await page.locator('.title-cath svg').waitFor()
  const still = await page.evaluate(() => ({
    hero: getComputedStyle(document.querySelector('.title-hero')!).animationName,
    parts: [...document.querySelectorAll('.title-board .piece-tray, .title-board .region-sign')].map((e) => getComputedStyle(e).animationName),
  }))
  expect(still.hero).toBe('title-opening-fade')
  for (const n of still.parts) expect(n).toBe('none')
})
