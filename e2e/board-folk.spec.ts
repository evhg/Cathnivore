import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 717: the market is alive: every region holds 2+ shoppers walking between its stalls, and no shopper, at
// either end of its walk, stands over a piece, a counter, a badge, a name plate, a status disc or the landmark.
// Under reduced motion they stand still.
const OVER = ['.stall-piece', '.piece-count', '.enemy-stack', '.region-plaque', '[data-region-status]', '.board-landmark', '.coop-stamp']

async function start(page: Page, seed: string) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, seed)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.map-wrap svg.map .region-folk').first()).toBeAttached()
  await page.waitForTimeout(800)
}

/** Each region's shoppers' boxes, and the boxes they must keep clear of, with every walker held at one end. */
function measure(page: Page, end: boolean) {
  return page.evaluate(
    ({ end, over }) => {
      for (const w of document.querySelectorAll<SVGGElement>('.map-wrap svg.map .folk-walk')) {
        w.style.animation = 'none'
        w.style.translate = end ? `${w.style.getPropertyValue('--wx')} ${w.style.getPropertyValue('--wy')}` : '0 0'
      }
      const box = (e: Element) => {
        const b = e.getBoundingClientRect()
        return { l: b.left, r: b.right, t: b.top, b: b.bottom }
      }
      return [...document.querySelectorAll<SVGGElement>('.map-wrap svg.map [data-region]')]
        .filter((g) => g.querySelector('.region-folk'))
        .map((g) => ({
          region: g.getAttribute('data-region')!,
          folk: [...g.querySelectorAll('.region-folk .folk-face')].map(box),
          // the pieces and badges drawn over the board anywhere (a neighbour's plate can reach into this hex)
          over: [...document.querySelectorAll(over.map((s) => `.map-wrap svg.map ${s}`).join(','))].map(box).filter((b) => b.r > b.l && b.b > b.t),
        }))
    },
    { end, over: OVER },
  )
}

const meets = (a: { l: number; r: number; t: number; b: number }, b: typeof a) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1

for (const seed of ['7', '19']) {
  test(`every region has 2+ shoppers, none over a piece or badge (seed ${seed})`, async ({ page }) => {
    await start(page, seed)
    for (const end of [false, true]) {
      const r = await measure(page, end)
      expect(r.length).toBeGreaterThanOrEqual(7)
      for (const g of r) {
        expect(g.folk.length, g.region).toBeGreaterThanOrEqual(2)
        for (const f of g.folk) {
          expect(f.b - f.t, `${g.region} shopper drawn`).toBeGreaterThan(3)
          for (const o of g.over) expect(meets(f, o), `${g.region} shopper ${end ? 'at the far end' : 'at the start'} over a piece`).toBe(false)
        }
      }
    }
  })
}

test('the shoppers walk and the awnings stir, all still under reduced motion', async ({ page }) => {
  await start(page, '7')
  const walking = await page.evaluate(() => [...document.querySelectorAll('.map-wrap svg.map .folk-walk')].filter((w) => w.getAnimations().some((a) => a.playState === 'running')).length)
  expect(walking).toBeGreaterThanOrEqual(7)
  const stirring = await page.evaluate(() => [...document.querySelectorAll('.map-wrap svg.map .awning-stir')].filter((w) => w.getAnimations().length > 0).length)
  expect(stirring).toBeGreaterThanOrEqual(2)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(200)
  const still = await page.evaluate(() => [...document.querySelectorAll('.map-wrap svg.map .folk-walk, .map-wrap svg.map .folk-face, .map-wrap svg.map .awning-stir')].flatMap((w) => w.getAnimations()).map((a) => (a as CSSAnimation).animationName ?? 'transition'))
  expect(still).toEqual([])
})
