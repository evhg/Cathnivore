import { expect, test } from '@playwright/test'

// Plan item 694: at D (1440x900) Cath hosts from the rail's foot at half length, not squeezed into the valley's corner
// (about 60x260 px, her face 20 px): her face 60 px or taller, her bubble beside her head in the rail, Bea's drawing
// pinned under it, the tap hint beside her, nothing of hers over the board's frame; her expression follows a watering
// tap and the solve; under reduced motion her look round is off. A short desktop keeps her in the valley.
const DAY = new Date('2026-11-25T10:00:00Z')

test('at 1440x900 she hosts from the rail at presence size', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1100, 'the desktop rail')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.clock.setFixedTime(DAY)
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  await expect(page.locator('.rail-host #valley-cath')).toBeVisible()
  await expect(page.locator('#valley-cath')).toHaveAttribute('data-framing', 'half')
  await expect(page.locator('.rail-host #valley-say')).toBeVisible()
  await page.waitForTimeout(600)
  const m = await page.evaluate(() => {
    const r = (q: string) => document.querySelector(q)!.getBoundingClientRect()
    const meet = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
    const fig = r('#valley-cath')
    const face = new DOMRect(fig.left + fig.width * 0.3, fig.top + fig.height * 0.14, fig.width * 0.4, fig.height * 0.28)
    const head = r('#valley-cath .cath-head')
    const say = r('#valley-say')
    const doodle = r('#rail-doodle')
    const hint = r('#hint')
    const stage = r('.stage')
    const rail = r('#rail')
    return {
      faceH: Math.round(face.height),
      headH: Math.round(head.height),
      shown: Math.round(Math.min(fig.bottom, innerHeight) - fig.top),
      sayOnFace: meet(say, face),
      sayInRail: say.left >= rail.left - 1 && say.right <= rail.right + 1 && say.bottom <= innerHeight,
      sayFont: parseFloat(getComputedStyle(document.getElementById('valley-say')!).fontSize),
      doodle: doodle.width > 0 && !meet(doodle, say),
      hintOnFace: meet(hint, face),
      overFrame: fig.right > stage.left || say.right > stage.left,
      wall: document.querySelectorAll('#valley-cath svg.valley-wall').length,
      sidebarPortrait: getComputedStyle(document.querySelector('.host')!).clipPath.startsWith('inset'),
      scroll: document.scrollingElement!.scrollHeight - innerHeight,
    }
  })
  expect(m.faceH).toBeGreaterThanOrEqual(60)
  expect(m.headH).toBeGreaterThanOrEqual(60)
  expect(m.shown).toBeGreaterThanOrEqual(260)
  expect(m).toMatchObject({ sayOnFace: false, sayInRail: true, doodle: true, hintOnFace: false, overFrame: false, wall: 0, sidebarPortrait: true, scroll: 0 })
  expect(m.sayFont).toBeGreaterThanOrEqual(15)
})

test('in the rail her face follows a tap and the solve', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1100, 'the desktop rail')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00Z'))
  await page.goto('/runnel/?nohelp&shotsolve')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  const cath = page.locator('.rail-host #valley-cath')
  await expect(cath).toBeVisible()
  const before = await cath.getAttribute('data-expression')
  const tile = page.locator('.tiles > g.cell:not(.stone):not(.fixed):not([data-last])').nth(2)
  await tile.click()
  await expect(cath).not.toHaveAttribute('data-expression', before ?? '')
  for (let k = 0; k < 5; k++) await tile.click()
  await page.locator('[data-last]').click()
  await expect(cath).toHaveAttribute('data-expression', 'delighted')
  await expect(cath).toHaveAttribute('data-pose', 'wave')
  // (the daily's result lands as a postcard on the field, so she stays in the rail)
  await expect(page.locator('#win-strip[data-postcard]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.rail-host #valley-cath')).toBeVisible()
})

test('under reduced motion she does not move as she looks round', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1100, 'the desktop rail')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(DAY)
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('.rail-host #valley-cath')).toBeVisible()
  await page.evaluate(() => document.getElementById('valley-cath')!.classList.add('look'))
  expect(await page.locator('#valley-cath').evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
})

test('on a short desktop she stays in the valley', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1100, 'the desktop rail')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.clock.setFixedTime(DAY)
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  await page.waitForTimeout(600)
  expect(await page.locator('.rail-host #valley-cath').count()).toBe(0)
  await expect(page.locator('.app')).not.toHaveAttribute('data-rail-cath', '')
})
