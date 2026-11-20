import { expect, test } from '@playwright/test'

// Plan item 471: on a desktop 860 px tall or more every stop is a diorama of its landmark 110 px wide or more, no two
// stops side by side share a landmark, and act 1's ten stops (their names too) stay inside a 1440x900 window.
test('at 1440x900 each stop is a 110 px landmark, no neighbours alike, the act inside the window', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop map')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const stars: Record<number, number> = { 1: 3, 2: 3, 3: 3 }
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 1: true, 2: true, 3: true, 4: true }, seen: {}, tips: { all: true }, bank: {} }))
  })
  await page.goto('/hedgerow/?2d')
  await page.waitForSelector('#screen-select .node.next .you')
  await page.waitForTimeout(1200)
  const r = await page.evaluate(() => {
    const act = document.querySelector('#screen-select .node.next')!.closest('li.act')!
    const nodes = [...act.querySelectorAll<HTMLElement>('.node')]
    return nodes.map((n) => {
      const c = n.querySelector('.level-num')!.getBoundingClientRect()
      const name = n.querySelector('.level-name')!.getBoundingClientRect()
      return { landmark: n.dataset.landmark ?? '', w: c.width, nameBottom: name.bottom + scrollY }
    })
  })
  expect(r.length).toBe(10)
  for (const [i, s] of r.entries()) {
    expect(s.w, `stop ${i + 1}`).toBeGreaterThanOrEqual(110)
    expect(s.landmark, `stop ${i + 1}`).not.toBe('')
    if (i) expect(s.landmark, `stop ${i + 1}`).not.toBe(r[i - 1]!.landmark)
    expect(s.nameBottom, `stop ${i + 1}`).toBeLessThanOrEqual(900)
  }
})

// Plan item 569: on an upright phone each stop is a diorama of its landmark 64 px across (a 44 px coin read as an
// icon), and no two stops in an act share a silhouette: each landmark (without the patch of ground they all share)
// drawn to an 8x8 alpha mask, every pair of an act's masks more than 10 of the 64 bits apart (desktop and phone
// draw the same art).
test('each stop its own landmark: 64 px on a phone, no two silhouettes alike in an act', async ({ page, hasTouch }) => {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const stars: Record<number, number> = {}
    for (let i = 1; i <= 23; i++) stars[i] = 1 + (i % 3)
    const seen: Record<number, boolean> = {}
    for (let i = 1; i <= 24; i++) seen[i] = true
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: seen, seen: {}, tips: { all: true }, bank: {} }))
  })
  await page.goto('/hedgerow/?2d')
  await page.waitForSelector('#screen-select .node.next .you')
  await page.waitForTimeout(1200)
  if (hasTouch) {
    const sizes = await page.locator('#screen-select li.act:has(.node.next) .node .level-num').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))
    expect(sizes.length).toBe(10)
    for (const w of sizes) expect(w).toBeGreaterThanOrEqual(64)
  }
  const acts = await page.evaluate(async () => {
    const mask = async (svg: SVGSVGElement) => {
      const copy = svg.cloneNode(true) as SVGSVGElement
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      copy.setAttribute('width', '64')
      copy.setAttribute('height', '64')
      // the landmark only: the patch of ground every stop shares is its first two shapes (stopart.ts `ground`)
      copy.firstElementChild?.remove()
      copy.firstElementChild?.remove()
      const img = new Image()
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy))
      await img.decode()
      const c = document.createElement('canvas')
      c.width = 8
      c.height = 8
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0, 8, 8)
      const d = g.getImageData(0, 0, 8, 8).data
      const bits: number[] = []
      for (let i = 0; i < 64; i++) bits.push(d[i * 4 + 3]! > 60 ? 1 : 0)
      return bits
    }
    const out: { act: number; keys: string[]; bits: number[][] }[] = []
    for (const [i, act] of [...document.querySelectorAll('#screen-select li.act')].entries()) {
      const nodes = [...act.querySelectorAll<HTMLElement>('.node')]
      if (nodes.length < 10) continue
      out.push({ act: i, keys: nodes.map((n) => n.dataset.landmark ?? ''), bits: await Promise.all(nodes.map((n) => mask(n.querySelector<SVGSVGElement>('.level-landmark')!))) })
    }
    return out
  })
  expect(acts.length).toBeGreaterThanOrEqual(3)
  const alike: string[] = []
  for (const a of acts)
    for (let i = 0; i < 10; i++)
      for (let j = i + 1; j < 10; j++) {
        const dist = a.bits[i]!.reduce((n, b, k) => n + (b !== a.bits[j]![k] ? 1 : 0), 0)
        if (dist <= 10) alike.push(`act ${a.act + 1}: ${a.keys[i]} / ${a.keys[j]} ${dist}`)
      }
  // 155 of the 450 pairs were alike on 2026-11-20 (cottage, stall, barn and van all low boxes; mast and lighthouse
  // both a mast) until item 569 slice 2 redrew 30 landmarks to their own outlines.
  expect(alike, alike.join('\n')).toEqual([])
})
