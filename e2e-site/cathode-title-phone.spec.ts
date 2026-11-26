import { expect, test } from './own-gpu'

// Plan item 652: an upright phone's title is composed as a poster around Cath. Once the live street draws, her face
// sits in the upper-middle of the screen (its centre 30-55% down), no menu row or the Ledger's tab covers it, and the
// tab (the folded paper) is a 44 px target that opens the paper and folds it again, her face still clear.

type B = { left: number; top: number; right: number; bottom: number }
type W = { cathodeFront?: { ready: boolean; scene(): { faceBox(): B; stats: { frames: number } } | null } }

test('at 390x844 the title frames her face in the upper middle, clear of the menu and the Ledger', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the upright phone title')
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as W).cathodeFront?.ready === true, null, { timeout: 150_000 })
  // The live 3D frame, not the poster under it.
  await page.waitForFunction(() => ((window as unknown as W).cathodeFront?.scene()?.stats.frames ?? 0) > 2, null, { timeout: 200_000 })
  const meets = (a: B, b: B) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const measure = () =>
    page.evaluate(() => {
      const box = (e: Element): B => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }
      return {
        face: (window as unknown as W).cathodeFront!.scene()!.faceBox(),
        menu: [...document.querySelectorAll('#menu .menu-label')].map(box),
        tab: box(document.querySelector('#ledger-tab')!),
        paper: document.querySelector('#dossier.is-open') ? box(document.querySelector('#dossier')!) : null,
        list: document.querySelector('.the-list') ? box(document.querySelector('.the-list')!) : null,
        card: document.querySelector('#menu') ? box(document.querySelector('#menu')!) : null,
        scroll: document.scrollingElement!.scrollHeight - innerHeight,
      }
    })
  const folded = await measure()
  const msg = JSON.stringify(folded)
  const mid = (folded.face.top + folded.face.bottom) / 2 / 844
  expect(mid, msg).toBeGreaterThanOrEqual(0.3)
  expect(mid, msg).toBeLessThanOrEqual(0.55)
  for (const m of folded.menu) expect(meets(m, folded.face), msg).toBe(false)
  // Plan item 678: she is the poster: her face 70 px+ tall, The List a strip below her shoulders (a face's height
  // under her chin) and whole on screen with the menu card, nothing scrolled.
  expect(folded.face.bottom - folded.face.top, msg).toBeGreaterThanOrEqual(70)
  expect(folded.list, msg).not.toBeNull()
  expect(folded.list!.top, msg).toBeGreaterThanOrEqual(folded.face.bottom + (folded.face.bottom - folded.face.top))
  for (const b of [folded.list!, folded.card!]) expect(b.top >= 0 && b.bottom <= 844 && b.left >= 0 && b.right <= 390, msg).toBe(true)
  expect(folded.scroll, msg).toBeLessThanOrEqual(0)
  expect(meets(folded.tab, folded.face), msg).toBe(false)
  expect(folded.tab.bottom - folded.tab.top, msg).toBeGreaterThanOrEqual(44)
  await expect(page.locator('#ledger-tab')).toHaveAttribute('aria-expanded', 'false')

  // Open: the paper unfolds under the tab, off her face.
  await page.locator('#ledger-tab').click()
  await expect(page.locator('#ledger-tab')).toHaveAttribute('aria-expanded', 'true')
  await page.waitForTimeout(1500)
  const open = await measure()
  expect(open.paper, JSON.stringify(open)).not.toBeNull()
  expect(meets(open.paper!, open.face), JSON.stringify(open)).toBe(false)
  // ...and a second tap folds it again.
  await page.locator('#ledger-tab').click()
  await expect(page.locator('#ledger-tab')).toHaveAttribute('aria-expanded', 'false')
})
