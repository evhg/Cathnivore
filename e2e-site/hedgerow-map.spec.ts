import { expect, test, type Page } from '@playwright/test'

// Plan item 18: the campaign map is the screen, and no banner sits on another stop's flag, padlock or banner.
const URL = '/hedgerow/?2d'

async function seed(page: Page, upTo: number): Promise<void> {
  await page.goto(URL)
  await page.evaluate((n) => {
    const stars: Record<string, number> = {}
    const seenBefore: Record<string, boolean> = {}
    for (let i = 1; i <= n; i++) {
      stars[String(i)] = 3
      seenBefore[String(i)] = true
    }
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: {}, bank: {} }))
  }, upTo)
  await page.reload()
  await expect(page.locator('button.node.next')).toBeVisible()
}

/** Share of the viewport the map shows, less the header and (on a phone) the tab bar laid over it. */
const mapShare = (page: Page) =>
  page.evaluate(() => {
    const area = (r: DOMRect) => Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left)) * Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top))
    const map = area(document.querySelector('#levels')!.getBoundingClientRect())
    const chrome = [document.querySelector('#screen-select > .top'), document.querySelector('#screen-select .top-tools')]
      .map((el) => el!.getBoundingClientRect())
      .filter((r) => getComputedStyle(document.querySelector('#screen-select .top-tools')!).position === 'fixed' || r.top < 100)
    // The tools sit inside the header on wide screens; count each band once.
    const bands = chrome.filter((r, i) => i === 0 || r.top > chrome[0]!.bottom)
    return (map - bands.reduce((a, r) => a + area(r), 0)) / (innerWidth * innerHeight)
  })

/** Pairs of overlapping boxes: banners against other stops' flags, padlocks and start tags, and against each other. */
const collisions = (page: Page) =>
  page.evaluate(() => {
    const ov = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
    const names = [...document.querySelectorAll<HTMLElement>('.node .level-name')]
    const solids = [...document.querySelectorAll<HTMLElement>('.node .level-num, .node .level-lock, .node .start-tag')]
    const hits: string[] = []
    for (const n of names) {
      const a = n.getBoundingClientRect()
      for (const s of solids) if (s.closest('.node') !== n.closest('.node') && s.offsetWidth && ov(a, s.getBoundingClientRect())) hits.push(`${n.textContent} on ${s.closest('.node')!.getAttribute('data-level')}`)
      for (const m of names) if (m !== n && ov(a, m.getBoundingClientRect())) hits.push(`${n.textContent} on ${m.textContent}`)
    }
    return hits
  })

test('plan item 18: the map covers at least 85% of the screen', async ({ page }) => {
  await seed(page, 13)
  expect(await mapShare(page)).toBeGreaterThanOrEqual(0.85)
  // Acts join edge to edge on their own ground, not as rounded cards.
  await expect(page.locator('li.act').first()).toHaveCSS('border-top-left-radius', '0px')
})

test('plan item 18: no banner overlaps another stop, its padlock or its banner (every act)', async ({ page }) => {
  await page.goto('/hedgerow/?2d&sandbox=1')
  await expect(page.locator('button.node[data-level="50"]')).toBeAttached()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  expect(await collisions(page)).toEqual([])
})

for (const reduced of [false, true]) {
  test(`plan item 18: the fog rolls back off a newly opened act once${reduced ? ' (a fade under reduced motion)' : ''}`, async ({ page }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    await seed(page, 9)
    await expect(page.locator('.unveil-fog')).toHaveCount(0)
    // Act 1's boss falls; the next time the map shows, act 2 opens under rolling fog.
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('hedgerow:v1')!)
      d.stars['10'] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify(d))
    })
    await page.reload()
    const fog = page.locator('li.act-unveil .unveil-fog')
    await expect(fog).toHaveCount(1)
    await expect(page.locator('li.act-unveil')).toHaveAttribute('data-act', '2')
    await expect(fog).toHaveCSS('animation-name', reduced ? 'fog-fade' : 'fog-roll')
    // It clears itself, and doesn't play again.
    await expect(fog).toHaveCount(0, { timeout: 6000 })
    await page.reload()
    await expect(page.locator('button.node.next')).toBeVisible()
    await expect(page.locator('.unveil-fog')).toHaveCount(0)
  })
}

// Plan item 47: every map tool sits whole inside the viewport, none over another; the rest are one Modes drawer away.
test('the map tools fit the screen, and Modes opens the rest inside it', async ({ page }) => {
  await seed(page, 13)
  const boxes = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('#screen-select .top-tools button')]
        .filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden')
        .map((e) => {
          const r = e.getBoundingClientRect()
          return { id: e.id, l: r.left, r: r.right, t: r.top, b: r.bottom }
        }),
    )
  const check = async () => {
    const bs = await boxes()
    const vw = await page.evaluate(() => innerWidth)
    const vh = await page.evaluate(() => innerHeight)
    for (const b of bs) {
      expect(b.l, b.id).toBeGreaterThanOrEqual(0)
      expect(b.r, b.id).toBeLessThanOrEqual(vw)
      expect(b.t, b.id).toBeGreaterThanOrEqual(0)
      expect(b.b, b.id).toBeLessThanOrEqual(vh)
    }
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i]!, c = bs[j]!
        expect(a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1, `${a.id} over ${c.id}`).toBe(false)
      }
  }
  await check()
  await page.locator('#btn-modes').click()
  await expect(page.locator('#btn-show')).toBeVisible()
  await check()
})

test('plan item 74: on a fresh farm the start tag replaces the empty stars, and its stack stays clear of row 2', async ({ page }) => {
  await seed(page, 0)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  const first = page.locator('button.node[data-level="1"]')
  await expect(first.locator('.start-tag')).toHaveText('Start here')
  await expect(first.locator('.level-stars')).toBeHidden()
  const r = await page.evaluate(() => {
    const n1 = document.querySelector<HTMLElement>('button.node[data-level="1"]')!
    const bottom = Math.max(...[...n1.querySelectorAll<HTMLElement>('.start-tag, .level-name')].map((e) => e.getBoundingClientRect().bottom))
    const row2 = document.querySelector<HTMLElement>('button.node[data-level="10"] .level-num')!.getBoundingClientRect().top
    return { bottom, row2 }
  })
  expect(r.bottom + 8).toBeLessThanOrEqual(r.row2)
  expect(await collisions(page)).toEqual([])
})
