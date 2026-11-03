import { test, expect } from '@playwright/test'

// Plan item 37: on a 390x844 phone the win card shows its headline, its primary button and Cath's whole
// medallion without scrolling; the share card and Bea's postcard swipe sideways below. `?shotwin` (the
// screenshot hook) never writes a result.
test('the win card fits its headline, button and medallion in view, and the shot hook saves nothing', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotwin')
  // Plan item 68: the win shows a strip under the board; the full card opens from it.
  await page.locator('#strip-card').click({ timeout: 10_000 })
  const dlg = page.locator('#dlg-win')
  await expect(dlg).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(700) // the sheet's slide-in
  const vh = page.viewportSize()!.height
  for (const sel of ['#win-title', '#btn-share', '#win-cath']) {
    const box = (await page.locator(sel).boundingBox())!
    expect(box.y, `${sel} top`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, `${sel} bottom`).toBeLessThanOrEqual(vh)
  }
  // The keepsakes are one sideways row, below the buttons.
  const share = (await page.locator('#btn-share').boundingBox())!
  const bea = (await page.locator('#win-bea').boundingBox())!
  expect(bea.y).toBeGreaterThan(share.y)
  expect(await page.locator('#win-keepsakes').evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto')
  expect(await page.evaluate(() => localStorage.getItem('runnel:v1'))).toBeNull()
})

// Plan item 47: no keepsake is cut off at rest. A phone shows one whole page with dots; a wide screen both.
test('the keepsakes are whole: one page at a time with dots on a phone, side by side when there is room', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotwin')
  await page.locator('#strip-card').click({ timeout: 10_000 })
  await expect(page.locator('#dlg-win')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('#win-card')).toBeVisible()
  await page.waitForTimeout(700)
  const m = await page.evaluate(() => {
    const row = document.querySelector('#win-keepsakes')!.getBoundingClientRect()
    const kids = [...document.querySelectorAll('#win-keepsakes .win-card, #win-keepsakes .bea')].map((e) => e.getBoundingClientRect())
    const whole = kids.map((r) => r.left >= row.left - 1 && r.right <= row.right + 1 && r.right <= innerWidth && r.left >= 0)
    const partly = kids.map((r) => r.right > row.left + 1 && r.left < row.right - 1)
    return { whole, partly, pager: !document.querySelector<HTMLElement>('#win-pager')!.hidden }
  })
  // Every keepsake in view is whole: none half in, half out.
  for (let i = 0; i < m.whole.length; i++) if (m.partly[i]) expect(m.whole[i], `keepsake ${i}`).toBe(true)
  if (m.pager) expect(m.partly.filter(Boolean).length).toBe(1)
  else expect(m.whole.every(Boolean)).toBe(true)
})

// Plan item 68: a real solve plays on the board, then a slim strip comes up from the foot: the board stays sharp and
// at least 80% in view, nothing modal opens, the page doesn't scroll, and the strip's text is 12 px or larger.
test('a solve leaves the board in view under a slim result strip', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotsolve')
  await page.locator('[data-last]').click()
  const strip = page.locator('#win-strip')
  await expect(strip).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const bd = document.getElementById('board')!.getBoundingClientRect()
    const st = document.getElementById('win-strip')!.getBoundingClientRect()
    const over = Math.max(0, Math.min(bd.right, st.right) - Math.max(bd.left, st.left)) * Math.max(0, Math.min(bd.bottom, st.bottom) - Math.max(bd.top, st.top))
    const sizes = [...document.querySelectorAll('#win-strip *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))
    return {
      visible: 1 - over / (bd.width * bd.height),
      modal: !!document.querySelector('dialog[open]'),
      scroll: document.scrollingElement!.scrollHeight - innerHeight,
      inView: st.top >= 0 && st.bottom <= innerHeight + 1 && st.left >= -1 && st.right <= innerWidth + 1,
      minFont: Math.min(...sizes),
    }
  })
  expect(m.visible).toBeGreaterThanOrEqual(0.8)
  expect(m.modal).toBe(false)
  expect(m.scroll).toBeLessThanOrEqual(1)
  expect(m.inView).toBe(true)
  expect(m.minFont).toBeGreaterThanOrEqual(12)
  // The full card is a tap away, and Next moves on and takes the strip with it.
  await page.locator('#strip-card').click()
  await expect(page.locator('#dlg-win')).toBeVisible()
  await page.locator('#btn-next').click()
  await expect(strip).toBeHidden()
})
