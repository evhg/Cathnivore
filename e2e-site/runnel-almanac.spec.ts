import { expect, test } from '@playwright/test'

// Plan item 158: the rail is today's page of Bea's almanac (desktop), and on a phone the stats sheet opens on it:
// the date as a masthead, the day's sky as a picture 120 px or wider, Bea's note; no empty band over 80 px in the rail.
test('the almanac page: masthead, sky and note, in the rail at D and the stats sheet at P', async ({ page, hasTouch }) => {
  await page.goto('/runnel/?nohelp&practice')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  const today = new Date().toISOString().slice(0, 10)
  if (!hasTouch) {
    const head = page.locator('#almanac-head')
    await expect(head).toHaveAttribute('data-almanac-date', today)
    await expect(page.locator('#al-note')).toContainText('Bea')
    expect((await page.locator('#al-sky-art svg').boundingBox())!.width).toBeGreaterThanOrEqual(120)
    const band = await page.evaluate(() => {
      const rail = document.getElementById('rail')!
      const r = rail.getBoundingClientRect()
      const kids = [...rail.children].map((c) => c.getBoundingClientRect()).filter((b) => b.height > 0).sort((a, b) => a.top - b.top)
      let reach = r.top
      let gap = 0
      for (const b of kids) {
        gap = Math.max(gap, b.top - reach)
        reach = Math.max(reach, b.bottom)
      }
      return Math.max(gap, r.bottom - reach)
    })
    expect(band).toBeLessThanOrEqual(80)
    // The page's text is 14 px or more.
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('#rail *')]
        .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && e.getBoundingClientRect().width > 0)
        .map((e) => parseFloat(getComputedStyle(e).fontSize))
        .filter((f) => f < 14),
    )
    expect(small).toEqual([])
  } else {
    await page.locator('#btn-stats').click()
    const head = page.locator('#dlg-stats .almanac-head')
    await expect(head).toBeVisible()
    await expect(head).toHaveAttribute('data-almanac-date', today)
    expect((await head.locator('.al-sky-art svg').boundingBox())!.width).toBeGreaterThanOrEqual(120)
    await expect(head.locator('.al-note')).toContainText('Bea')
  }
})
