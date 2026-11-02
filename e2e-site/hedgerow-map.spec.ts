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
