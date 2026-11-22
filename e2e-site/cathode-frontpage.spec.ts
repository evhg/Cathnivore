import { expect, test } from './own-gpu'

// Plan item 494: the title's case file is the morning paper. A fresh save reads the teaser on Tomas Reed; after a
// closed case the front page is that case's (`data-case`), its headline changes, a new edition spins in once, and the
// headline holds 7:1 and the body 4.5:1 on the newsprint. It stays clear of the menu, The List and Cath.
type C = { stats: { frames: number }; progress: { jobsDone: string[]; save(): void } }
type Front = { cathodeFront?: { ready?: boolean } }
const ACT1 = ['fishMarket', 'crispLead', 'quayContracts', 'candorManifest', 'crispBoss']

async function title(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
}

/** WCAG contrast of an element's text on the paper's own colour. */
async function contrast(page: import('@playwright/test').Page, sel: string): Promise<number> {
  return page.evaluate((sel) => {
    const rgb = (c: string): number[] => {
      const m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c)
      if (m) return [1, 2, 3].map((i) => Number(m[i]) * 255)
      return (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
    }
    const lum = (c: number[]): number => {
      const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    const box = document.querySelector('#dossier')!
    const probe = document.createElement('i')
    probe.style.background = 'var(--news)'
    box.append(probe)
    const paper = lum(rgb(getComputedStyle(probe).backgroundColor))
    probe.remove()
    const ink = lum(rgb(getComputedStyle(document.querySelector(sel)!).color))
    return (Math.max(paper, ink) + 0.05) / (Math.min(paper, ink) + 0.05)
  }, sel)
}

test('the title case file is the morning paper, and it reports the last case', async ({ page, hasTouch }) => {
  test.setTimeout(480_000)
  await page.setViewportSize(hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await page.goto('/nightshift/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await title(page)
  const paper = page.locator('#dossier.is-open[data-front-page]')
  // Plan item 652: an upright phone folds the paper to a tab under the menu; a tap opens it.
  if (hasTouch) await page.locator('#ledger-tab').click()
  await expect(paper).toBeVisible()
  await expect(paper).toHaveAttribute('data-case', 'reed')
  const teaser = await paper.locator('.fp-head').textContent()
  expect(teaser).toMatch(/Water-Taxi/)
  await expect(paper).not.toHaveClass(/is-fresh/)
  expect(await contrast(page, '#dossier .fp-head')).toBeGreaterThanOrEqual(7)
  for (const s of ['.dossier-target', '.dossier-place']) expect(await contrast(page, `#dossier ${s}`), s).toBeGreaterThanOrEqual(4.5)
  if (!hasTouch) for (const s of ['.fp-dek', '.fp-classified', '.fp-date']) expect(await contrast(page, `#dossier ${s}`), s).toBeGreaterThanOrEqual(4.5)

  // A real save from the game itself, with act 1 closed, and the debrief's record of the Crisp case.
  await page.goto('/nightshift/?play&class=ghost&rs=0.5')
  await page.waitForFunction(() => ((window as unknown as { cathode?: C }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })
  await page.evaluate((jobs) => {
    const c = (window as unknown as { cathode: C }).cathode
    c.progress.jobsDone.push(...jobs)
    c.progress.save()
    localStorage.setItem('cathode:last-case:v1', JSON.stringify({ caseId: 'crispBoss', grade: 'S', spotted: false, kills: 6 }))
  }, ACT1)
  await title(page)
  await expect(paper).toHaveAttribute('data-case', 'crispBoss')
  const head = await paper.locator('.fp-head').textContent()
  expect(head).not.toBe(teaser)
  await expect(paper.locator('.fp-dek')).toContainText('no witnesses')
  // A new edition spins in, once.
  if (!hasTouch) await expect(paper).toHaveClass(/is-fresh/)
  await page.reload()
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  await expect(paper).toHaveAttribute('data-case', 'crispBoss')
  await expect(paper).not.toHaveClass(/is-fresh/)

  // Clear of the menu's words, The List and the frame.
  const m = await page.evaluate(() => {
    const r = (e: Element) => e.getBoundingClientRect()
    const card = r(document.querySelector('#dossier')!)
    const menu = [...document.querySelectorAll('#menu .menu-label')].map(r)
    const wall = r(document.querySelector(innerWidth > 700 ? '#the-list-wall' : '.the-list')!)
    const meets = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    return { menu: menu.some((b) => meets(card, b)), wall: meets(card, wall), left: card.left, right: card.right }
  })
  expect(m.menu).toBe(false)
  expect(m.wall).toBe(false)
  expect(m.left).toBeGreaterThanOrEqual(0)
  expect(m.right).toBeLessThanOrEqual(page.viewportSize()!.width)
})
