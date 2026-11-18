import { expect, test } from '@playwright/test'

// Plan item 420: on the act map Cath stands on her stop (a token 64 px tall or more, her foot within 8 px of the
// coin), walks the trail to a newly opened stop in about a second, and the docked level card covers no trail.
for (const vp of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
]) {
  test(`at ${vp.width}x${vp.height} Cath stands on her stop and the card keeps off the trail`, async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'desktop sizes')
    await page.setViewportSize(vp)
    await page.goto('/hedgerow/')
    await page.waitForSelector('#screen-select .node.next .you')
    await page.waitForTimeout(1200)
    const r = await page.evaluate(() => {
      const you = document.querySelector('#screen-select .node.next .you')!.getBoundingClientRect()
      const c = document.querySelector('#screen-select .node.next .level-num')!.getBoundingClientRect()
      const fx = you.x + you.width / 2
      const fy = you.bottom
      const gap = Math.hypot(Math.max(c.left - fx, 0, fx - c.right), Math.max(c.top - fy, 0, fy - c.bottom))
      // The trail's own strokes, sampled along their length, against the docked card's box.
      const card = document.querySelector('#screen-select .act-has-card .level-card')?.getBoundingClientRect()
      let hits = 0
      if (card && card.width) {
        for (const path of document.querySelectorAll<SVGPathElement>('#screen-select .act-has-card .trail-path path')) {
          const m = path.getScreenCTM()
          if (!m || getComputedStyle(path).visibility === 'hidden') continue
          const len = path.getTotalLength()
          for (let s = 0; s <= len; s += 4) {
            const p = path.getPointAtLength(s).matrixTransform(m)
            if (p.x > card.left && p.x < card.right && p.y > card.top && p.y < card.bottom) hits++
          }
        }
      }
      return { h: you.height, gap, hits, card: !!card }
    })
    // (plan item 496: 110 px+ on a desktop of 1100 px or more; 64 px+ elsewhere)
    expect(r.h).toBeGreaterThanOrEqual(!hasTouch && vp.width >= 1100 ? 110 : 64)
    expect(r.gap).toBeLessThanOrEqual(8)
    expect(r.card).toBe(true)
    expect(r.hits).toBe(0)
  })
}

test('her walk down the trail takes about a second', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one check is enough')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/')
  await page.waitForSelector('#screen-select .node.next .you')
  const d = await page.evaluate(() => {
    const you = document.querySelector<HTMLElement>('#screen-select .node.next .you')!
    you.classList.add('walking')
    const s = getComputedStyle(you)
    const names = s.animationName.split(',').map((x) => x.trim())
    return parseFloat(s.animationDuration.split(',')[names.indexOf('walk')]!)
  })
  expect(d).toBeGreaterThanOrEqual(0.8)
  expect(d).toBeLessThanOrEqual(1.2)
})
