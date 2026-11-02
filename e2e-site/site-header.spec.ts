import { test, expect, type Page } from '@playwright/test'

// Plan item 38: on the portfolio, a case study and /games/, after scrolling 1.5 screens no text shows
// through the header: any text under its box (other than its own) sits behind solid glass. The hero's
// scroll cue touches no text.
type Box = { x: number; y: number; w: number; h: number }

async function textUnderHeader(page: Page): Promise<{ header: Box | null; under: string[]; solid: boolean }> {
  return page.evaluate(() => {
    const header = Array.from(document.querySelectorAll<HTMLElement>('header, .top')).find((h) => {
      const pos = getComputedStyle(h).position
      return pos === 'sticky' || pos === 'fixed'
    })
    if (!header) return { header: null, under: [], solid: true }
    const hr = header.getBoundingClientRect()
    const under: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim() || header.contains(n)) continue
      const el = n.parentElement
      if (!el || el.closest('[aria-hidden="true"]') || getComputedStyle(el).visibility === 'hidden') continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const r of Array.from(range.getClientRects())) {
        if (r.width > 0 && r.height > 0 && r.top < hr.bottom && r.bottom > hr.top && r.left < hr.right && r.right > hr.left) {
          under.push(n.textContent.trim().slice(0, 30))
          break
        }
      }
    }
    const glass = getComputedStyle(header, '::before')
    const alpha = Number(/rgba?\([^)]*?,\s*([\d.]+)\)/.exec(glass.backgroundColor)?.[1] ?? (glass.backgroundColor.startsWith('rgb(') ? 1 : 0))
    const solid = (glass.maskImage === 'none' || glass.maskImage === '') && alpha >= 0.9
    return { header: { x: hr.x, y: hr.y, w: hr.width, h: hr.height }, under, solid }
  })
}

for (const [name, path] of [['portfolio', '/'], ['case study', '/work/games/'], ['games', '/games/']] as const) {
  test(`${name}: scrolled text never shows through the header`, async ({ page }) => {
    await page.goto(path)
    for (const screens of [1.5, 1.62, 2.1]) {
      await page.evaluate((y) => window.scrollTo(0, innerHeight * y), screens)
      await page.waitForTimeout(300)
      const { header, under, solid } = await textUnderHeader(page)
      if (header && under.length > 0) expect(solid, `at ${screens} screens, text under the header (${under.slice(0, 3).join(' | ')}) shows through`).toBe(true)
    }
  })
}

test('the hero\'s scroll cue touches no text', async ({ page }) => {
  await page.goto('/')
  const cue = page.locator('.scroll-cue')
  if (!(await cue.isVisible())) return // hidden on a phone
  const hits = await cue.evaluate((c) => {
    const cr = c.getBoundingClientRect()
    const out: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const r of Array.from(range.getClientRects())) {
        if (r.width > 0 && r.top < cr.bottom && r.bottom > cr.top && r.left < cr.right && r.right > cr.left) out.push(n.textContent.trim())
      }
    }
    return out
  })
  expect(hits).toEqual([])
})
