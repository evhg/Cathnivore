import { expect, test, type Page } from '@playwright/test'

// Plan item 27: Hedgerow's story scenes on a full stage. Each speaker stands at half length, at least half the
// viewport tall, with the face in view and clear of the line's band; Next, Skip and the keyboard work; reduced
// motion swaps the panel wipes for fades.
const URL = '/hedgerow/?2d'

async function openFirstScene(page: Page): Promise<void> {
  await page.goto(URL)
  await page.evaluate(() =>
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: {}, seen: { 'hedgerow-intro': true, intro: true, how: true }, tips: {}, bank: {} })),
  )
  await page.reload()
  await page.locator('button.node:not([disabled])').first().click()
  await expect(page.locator('#dlg-story')).toBeVisible()
}

/** The speaker's figure and face on screen (the face box mapped through the SVG's own transform), and the band. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const speech = document.querySelector('#story-speech')!.getBoundingClientRect()
    const who = document.querySelector('#story-speech')!.getAttribute('data-who')
    const el = document.querySelector<HTMLElement>(who === 'cath' ? '#story-left' : '#story-right')!
    const svg = el.querySelector('svg')!
    // Face boxes in each drawing's own units: Cath's (shared/cath, the `face` framing) and the cast's.
    const box = svg.classList.contains('cast') ? [44, 36, 116, 142] : [122, 52, 278, 240]
    const m = svg.getScreenCTM()!
    const pt = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(m)
    const a = pt(box[0]!, box[1]!)
    const b = pt(box[2]!, box[3]!)
    return {
      who,
      speaking: el.classList.contains('speaking'),
      share: el.getBoundingClientRect().height / innerHeight,
      face: { left: a.x, top: a.y, right: b.x, bottom: b.y },
      speechTop: speech.top,
      vw: innerWidth,
      vh: innerHeight,
    }
  })

const SIZES = [
  ['P', { width: 390, height: 844 }],
  ['D', { width: 1440, height: 900 }],
  ['L', { width: 844, height: 390 }],
] as const

for (const [name, viewport] of SIZES) {
  test.describe(`story stage ${name}`, () => {
    test.use({ viewport })

    test('every speaker stands half the viewport tall with the face in view', async ({ page }) => {
      await openFirstScene(page)
      const seen = new Set<string>()
      for (let i = 0; i < 6 && (await page.locator('#dlg-story[open]').count()); i++) {
        await page.waitForTimeout(500)
        const m = await measure(page)
        if (m.who && m.who !== 'narrator') {
          seen.add(m.who)
          expect(m.speaking).toBe(true)
          expect(m.share, `${m.who} figure height`).toBeGreaterThanOrEqual(0.5)
          expect(m.face.left, `${m.who} face left`).toBeGreaterThanOrEqual(0)
          expect(m.face.right, `${m.who} face right`).toBeLessThanOrEqual(m.vw)
          expect(m.face.top, `${m.who} face top`).toBeGreaterThanOrEqual(0)
          expect(m.face.bottom, `${m.who} face clear of the band`).toBeLessThanOrEqual(m.speechTop + 1)
        }
        if ((await page.locator('#story-next').textContent()) === "Let's go") break
        await page.locator('#story-next').click()
      }
      expect([...seen]).toEqual(expect.arrayContaining(['cath', 'mara']))
    })
  })
}

test('keyboard: the arrow key steps on, Escape skips into the level', async ({ page }) => {
  await openFirstScene(page)
  const first = await page.locator('#story-full').textContent()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#story-full')).not.toHaveText(first!)
  await page.keyboard.press('Enter')
  await expect(page.locator('#story-full')).not.toHaveText(first!)
  await page.keyboard.press('Escape')
  await expect(page.locator('#dlg-story')).not.toBeVisible()
  await expect(page.locator('#screen-play')).toBeVisible()
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('the stage, the figures and each line fade instead of wiping', async ({ page }) => {
    await openFirstScene(page)
    const names = await page.evaluate(() =>
      ['#dlg-story', '#story-left', '#story-speech'].map((s) => getComputedStyle(document.querySelector(s)!).animationName),
    )
    expect(names).toEqual(['stage-fade', 'stage-fade', 'stage-fade'])
    await page.locator('#story-next').click()
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#story-speech')!).animationName)).toBe('stage-fade')
  })
})
