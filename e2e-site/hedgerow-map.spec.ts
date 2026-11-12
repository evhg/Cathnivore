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
  // Plan item 153 (was item 18's fog): a newly opened act inks in from its pencil drawing, once.
  test(`plan item 153: a newly opened act inks in from pencil once${reduced ? ' (a fade under reduced motion)' : ''}`, async ({ page }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    await seed(page, 9)
    await expect(page.locator('.unveil-wash')).toHaveCount(0)
    await expect(page.locator('li[data-act="2"]')).toHaveAttribute('data-pencil', '')
    // Act 1's boss falls; the next time the map shows, act 2 inks in.
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('hedgerow:v1')!)
      d.stars['10'] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify(d))
    })
    await page.reload()
    const wash = page.locator('li.act-unveil .unveil-wash')
    await expect(wash).toHaveCount(1)
    await expect(page.locator('li.act-unveil')).toHaveAttribute('data-act', '2')
    await expect(page.locator('li[data-act="2"]')).not.toHaveAttribute('data-pencil', '')
    await expect(wash).toHaveCSS('animation-name', reduced ? 'ink-fade' : 'ink-in')
    // It clears itself, and doesn't play again.
    await expect(wash).toHaveCount(0, { timeout: 8000 })
    await expect(page.locator('li.act-unveil')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('button.node.next')).toBeVisible()
    await expect(page.locator('.unveil-wash')).toHaveCount(0)
  })
}

// Plan item 153: act runs into act: a hedge along every act's foot but the last, the lane leaving through its gate,
// and on a phone the pencil act's note sits clear of the act's title.
test('plan item 153: a hedge with a gate the lane goes through joins each act to the next', async ({ page }) => {
  await seed(page, 13)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  const m = await page.evaluate(() => {
    const acts = [...document.querySelectorAll<HTMLElement>('#levels > li[data-act]')]
    return acts.map((li) => {
      const hedge = li.querySelector<HTMLElement>(':scope > .act-hedge')
      const gate = hedge?.querySelector('.hedge-gate')?.getBoundingClientRect()
      const lb = li.getBoundingClientRect()
      const last = [...li.querySelectorAll('.stop .level-num')].pop()?.getBoundingClientRect()
      const names = [...li.querySelectorAll('.stop .level-name')].map((n) => n.getBoundingClientRect())
      const hb = hedge?.getBoundingClientRect()
      const note = li.querySelector('.act-pencil-note')?.getBoundingClientRect()
      const title = li.querySelector('.act-title')?.getBoundingClientRect()
      return {
        hedge: !!hedge,
        atFoot: hb ? Math.abs(hb.bottom - lb.bottom) : -1,
        gateOff: gate && last ? Math.abs(gate.left + gate.width / 2 - (last.left + last.width / 2)) : -1,
        overName: hb ? names.some((n) => n.bottom > hb.top + 14 && n.right > hb.left && n.left < hb.right) : false,
        noteOverTitle: note && title ? note.bottom > title.top && note.top < title.bottom && note.right > title.left && note.left < title.right : false,
      }
    })
  })
  expect(m).toHaveLength(10)
  m.forEach((a, i) => {
    expect(a.hedge, `act ${i + 1}`).toBe(i < 9)
    expect(a.noteOverTitle, `act ${i + 1} note`).toBe(false)
    if (i === 9) return
    expect(a.atFoot, `act ${i + 1}`).toBeLessThanOrEqual(1)
    expect(a.gateOff, `act ${i + 1} gate`).toBeLessThanOrEqual(6)
    expect(a.overName, `act ${i + 1} names`).toBe(false)
  })
})

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

// Plan item 73: every stop is a painted vignette (its landmark on the plinth, its number a badge), 44 px or larger,
// in colour once open and in pencil grey while locked.
test('plan item 73: every stop is a landmark vignette, 44 px or larger, in sepia while locked', async ({ page }) => {
  await seed(page, 6)
  // The stops scale in as the map opens; measure them at rest.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().iterations ?? 1) === Infinity))
  const nodes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>('button.node')].slice(0, 10).map((b) => {
      const coin = b.querySelector('.level-num')!.getBoundingClientRect()
      const mark = b.querySelector('.level-num .level-landmark')
      return { w: coin.width, h: coin.height, mark: !!mark, art: mark?.getAttribute('data-stop-art'), next: b.classList.contains('next'), pennant: getComputedStyle(b.querySelector('.level-num')!, '::after').animationName, badge: b.querySelector('.level-num .level-n')?.textContent, locked: b.disabled, ink: mark?.querySelector('path, circle, rect, ellipse, polygon') ? getComputedStyle(mark.querySelector('path, circle, rect, ellipse, polygon')!).stroke : '' }
    }),
  )
  expect(nodes).toHaveLength(10)
  nodes.forEach((n, i) => {
    expect(Math.min(n.w, n.h), `node ${i + 1}`).toBeGreaterThanOrEqual(44)
    expect(n.mark).toBe(true)
    expect(n.badge).toBe(String(i + 1))
    // Plan item 314: a locked stop is drawn in one sepia ink (it was greyscale); an open one keeps its own colours.
    // Plan item 241: each stop its own painted landmark; the next one flies a bobbing pennant.
    expect(n.art, `node ${i + 1}`).toBeTruthy()
    if (n.next) expect(n.pennant).toBe('pennant-bob')
  })
  expect(new Set(nodes.map((n) => n.art)).size).toBeGreaterThanOrEqual(8)
  const lockedInk = new Set(nodes.filter((n) => n.locked).map((n) => n.ink))
  expect(lockedInk.size).toBe(1)
  const [sepia] = [...lockedInk]
  const rgb = (sepia ?? '').match(/[\d.]+/g)!.map(Number)
  expect(rgb[0]!, 'warm, not grey').toBeGreaterThan(rgb[2]! * 1.15)
  for (const n of nodes.filter((x) => !x.locked)) expect(n.ink).not.toBe(sepia)
})

// Plan item 153: the journey is one painted country: every act in the one scroller, those past the last open act in
// pencil with their stops shut and their names in full ink (4.5:1 on the paper), the next act's top on the first
// screen, and its note naming the boss that opens it.
test('plan item 153: every act is on one map, the locked ones in pencil', async ({ page }) => {
  await seed(page, 13)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const acts = page.locator('#levels > li[data-act]')
  await expect(acts).toHaveCount(10)
  await expect(page.locator('#levels li[data-pencil]')).toHaveCount(8)
  const next = page.locator('#levels li[data-act="3"]')
  await expect(next).toHaveAttribute('data-pencil', '')
  await expect(next.locator('.act-pencil-note')).toContainText("Beat Mr Crisp's Convoy")
  await expect(next.locator('button.node:not(:disabled)')).toHaveCount(0)
  const m = await page.evaluate(() => {
    const list = document.querySelector('#levels')!.getBoundingClientRect()
    const nextTop = document.querySelector('#levels li[data-act="3"]')!.getBoundingClientRect().top
    const lum = (c: string) => {
      const v = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((x) => Number(x) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!
    }
    // The names sit on their paper label; the pencil filter greys both alike, so compare their own colours.
    const names = [...document.querySelectorAll<HTMLElement>('li[data-act="3"] .level-name')].map((n) => {
      const fg = lum(getComputedStyle(n).color)
      let bg = 1
      for (let e: HTMLElement | null = n; e; e = e.parentElement) {
        const b = getComputedStyle(e).backgroundColor
        if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { bg = lum(b); break }
      }
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
    })
    return { into: Math.min(innerHeight, list.bottom) - nextTop, names }
  })
  expect(m.into).toBeGreaterThanOrEqual(60)
  for (const c of m.names) expect(c).toBeGreaterThanOrEqual(4.5)
})

test('plan item 73: Cath\'s token never covers another stop\'s name', async ({ page }) => {
  for (const upTo of [3, 6]) {
    await seed(page, upTo)
    await page.waitForTimeout(400)
    const hits = await page.evaluate(() => {
      const you = document.querySelector('.node .you')!
      const own = you.closest('.node')
      const r = you.getBoundingClientRect()
      return [...document.querySelectorAll('.node .level-name')]
        .filter((n) => n.closest('.node') !== own)
        .filter((n) => { const b = n.getBoundingClientRect(); return b.width > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top })
        .map((n) => n.textContent)
    })
    expect(hits, `after ${upTo}`).toEqual([])
  }
})

test('plan item 73: picking another open stop, Cath walks to it before it opens', async ({ page }) => {
  await seed(page, 6)
  await page.goto('/hedgerow/?2d&walk')
  await expect(page.locator('button.node.next')).toBeVisible()
  await page.locator('button.node[data-level="2"]').click()
  await expect(page.locator('button.node[data-level="2"] .you.picked')).toHaveCount(1)
  await expect(page.locator('button.node[data-level="7"] .you')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => !!document.querySelector('dialog[open]') || !!document.querySelector<HTMLElement>('#screen-select')?.hidden), { timeout: 5000 }).toBe(true)
})

test('plan item 84: Cath stands clear of her coin, and a locked boss keeps its name clear of its padlock', async ({ page }) => {
  await seed(page, 20)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().iterations ?? 1) === Infinity))
  const m = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect()
    return {
      you: r('button.node[data-level="21"] .you'),
      coin: r('button.node[data-level="21"] .level-num'),
      lock: r('button.node[data-level="30"] .level-lock').bottom,
      name: r('button.node[data-level="30"] .level-name').top,
    }
  })
  // Plan item 124: she stands beside it on the road, not on it.
  expect(m.you.right <= m.coin.left || m.you.left >= m.coin.right, JSON.stringify(m)).toBe(true)
  if ((page.viewportSize()?.width ?? 0) >= 600) expect(m.name - m.lock).toBeGreaterThanOrEqual(3)
})

test('plan item 88: the next level\'s card: Play on the first screen, a stop focused shows on it, Play opens it', async ({ page }) => {
  await seed(page, 13)
  const card = page.locator('#screen-select .level-card')
  await expect(card).toBeVisible()
  await expect(card.locator('.lcard-name')).toHaveText(await page.locator('button.node.next .level-name').evaluate((e) => e.firstChild!.textContent!.trim()))
  const play = card.locator('.lcard-play')
  const box = (await play.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.width).toBeGreaterThanOrEqual(160)
  expect(box.height).toBeGreaterThanOrEqual(48)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  expect(box.y).toBeGreaterThanOrEqual(0)
  // Plan item 174: a phone's sheet peeks its name and Play; its grip pulls up the field's plate.
  if (vp.width < 900) await card.locator('.lcard-grip').click()
  await expect(card.locator('.lcard-thumb svg').filter({ visible: true })).toHaveCount(1)
  // Focusing another open stop shows it on the card.
  await page.locator('button.node[data-level="12"]').focus()
  await expect(card.locator('.lcard-name')).toHaveText('Cheap Eggs')
  await expect(play).toHaveText('Play again')
  await page.locator('button.node[data-level="14"]').focus()
  await play.click()
  // A stop not seen before opens its story first, then the field.
  await expect(page.locator('#screen-play:not([hidden]), #story-scene:visible').first()).toBeVisible({ timeout: 15_000 })
})

test('plan item 98: on a phone the level card sits whole above the tab bar', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 900, 'at D the card docks under its act')
  for (const upTo of [0, 13]) {
    if (upTo) await seed(page, upTo)
    else await page.goto(URL)
    const card = page.locator('#screen-select .level-card')
    await expect(card).toBeVisible()
    const tools = await page.locator('#screen-select .top-tools').boundingBox()
    const c = (await card.boundingBox())!
    const vp = page.viewportSize()!
    const foot = tools && tools.y > vp.height / 2 ? tools.y : vp.height
    expect(c.y).toBeGreaterThanOrEqual(0)
    expect(c.y + c.height).toBeLessThanOrEqual(foot + 1)
  }
})

// Plan item 111: at D the stops are landmarks 72 px or larger and Cath's token is 60 px tall, clear of her coin.
test('plan item 111: at D the stops are 72 px landmarks and Cath is 110 px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'site-desktop', 'the desktop map')
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page, 6)
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => ({
    coins: [...document.querySelectorAll('.node .level-num')].map((e) => e.getBoundingClientRect().width).filter((w) => w > 0),
    you: document.querySelector('.node .you')!.getBoundingClientRect().height,
  }))
  expect(m.coins.length).toBeGreaterThan(5)
  expect(Math.min(...m.coins)).toBeGreaterThanOrEqual(72)
  expect(m.you).toBeGreaterThanOrEqual(118) // plan item 250: 120 px at D
})

// Plan item 111: a shorter desktop keeps the smaller stops, so the level card's Play stays on screen at 1280x800.
test('plan item 111: at 1280x800 Play is on screen on act 1', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'site-desktop', 'the desktop map')
  await page.setViewportSize({ width: 1280, height: 800 })
  await seed(page, 6)
  await page.waitForTimeout(400)
  const play = (await page.locator('.level-card button', { hasText: 'Play' }).first().boundingBox())!
  expect(play.y + play.height).toBeLessThanOrEqual(800)
})

// Plan item 124: Cath stands on the road at full length beside her stop, clear of every label and padlock, and a
// locked stop is a pencil sketch (under 15% saturation) that comes into colour (over 30%) when it opens.
for (const upTo of [3, 23]) {
  test(`plan item 124: Cath at full length on the road, and locked stops in pencil (act ${upTo < 10 ? 1 : 3})`, async ({ page, hasTouch }) => {
    await seed(page, upTo)
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().iterations ?? 1) === Infinity))
    const m = await page.evaluate(() => {
      const you = document.querySelector('.node.next .you')!
      const r = you.getBoundingClientRect()
      const ov = (b: DOMRect) => b.width > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top
      const hits = [...document.querySelectorAll<HTMLElement>('.node .level-name, .node .level-lock, .node .start-tag, .node .level-num')]
        .filter((e) => !(e.matches('.level-num') && e.contains(you)) && ov(e.getBoundingClientRect()))
        .map((e) => `${e.className} @${e.closest('.node')!.getAttribute('data-level')}`)
      return { h: r.height, pose: (you as HTMLElement).dataset.pose, full: !!you.querySelector('svg.cath .cath-lower'), hits }
    })
    expect(m.full, JSON.stringify(m)).toBe(true)
    expect(m.pose).toBe('clasped')
    expect(m.h).toBeGreaterThanOrEqual(hasTouch ? 64 : (page.viewportSize()!.height >= 860 ? 110 : 76))
    expect(m.hits).toEqual([])
    // Saturation of each landmark's own ink: the HSV saturation of every fill and stroke its shapes paint, after the
    // landmark's filter (a rectangle of pixels also takes in the field and the coin's paper around it).
    const sat = (level: number) =>
      page.evaluate((level) => {
        const svg = document.querySelector<SVGElement>(`button.node[data-level="${level}"] .level-landmark`)!
        if (/grayscale\(1\)/.test(getComputedStyle(svg).filter)) return 0
        const s = (c: string) => {
          const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/)
          if (!m || m[4] === '0') return 0
          const v = [+m[1]!, +m[2]!, +m[3]!]
          const mx = Math.max(...v)
          return mx ? (mx - Math.min(...v)) / mx : 0
        }
        let top = 0
        for (const el of svg.querySelectorAll('*')) {
          const cs = getComputedStyle(el)
          if (cs.fill !== 'none') top = Math.max(top, s(cs.fill))
          if (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) top = Math.max(top, s(cs.stroke))
        }
        return top
      }, level)
    const open = await sat(upTo)
    const locked = await sat(upTo + 2)
    expect(open, `open ${upTo}`).toBeGreaterThan(0.3)
    expect(locked, `locked ${upTo + 2}`).toBeLessThan(0.15)
  })
}

// Plan item 209: on an upright phone each act's road snakes down the screen two stops a bend, the names beside
// their coins (no two names meeting, none on another coin), 13 px or more, and no sideways scroll; wider screens
// keep the two rows of five.
test('plan item 209: the phone road runs down the screen, names beside their stops', async ({ page }) => {
  await seed(page, 23)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
  const phone = (page.viewportSize()?.width ?? 0) < 600
  const m = await page.evaluate(() => {
    const meet = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
    return [...document.querySelectorAll<HTMLElement>('#levels .trail')].map((t) => {
      const names = [...t.querySelectorAll<HTMLElement>('.stop .level-name')]
      const nb = names.map((n) => n.getBoundingClientRect())
      const coins = [...t.querySelectorAll<HTMLElement>('.stop .level-num')].map((c) => c.getBoundingClientRect())
      return {
        road: t.dataset.road,
        clash: nb.some((a, i) => nb.some((b, j) => j > i && meet(a, b)) || coins.some((c, j) => j !== i && meet(a, c))),
        minFont: Math.min(...names.map((n) => parseFloat(getComputedStyle(n).fontSize))),
      }
    })
  })
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(sideways).toBe(false)
  for (const [i, a] of m.entries()) {
    expect(a.road, `act ${i + 1}`).toBe(phone ? 'vertical' : 'rows')
    if (!phone) continue
    expect(a.clash, `act ${i + 1} names`).toBe(false)
    expect(a.minFont, `act ${i + 1} font`).toBeGreaterThanOrEqual(13)
  }
})

// Plan item 211: on an upright phone the map fades out above the tab bar, so the next act's banner isn't sliced.
test('the phone map fades out above the tab bar', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 600, 'upright phone only')
  await seed(page, 20)
  const mask = await page.locator('#levels').evaluate((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage)
  expect(mask).toContain('linear-gradient')
  const nav = (await page.locator('#screen-select .top-tools').boundingBox())!
  const levels = (await page.locator('#levels').boundingBox())!
  // The fade ends at or above the tab bar's top edge.
  expect(levels.y + levels.height - 70).toBeLessThanOrEqual(nav.y + 2)
})

// Plan item 230: the land round a won stop is coloured in, a stop not yet won shows Hollowell's clutter, and a new
// win's land blooms once.
test('the map colours in won stops and blooms a new win once', async ({ page }) => {
  await page.goto(URL)
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i <= 20; i++) stars[String(i)] = 2
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seen: {}, tips: { all: true }, bank: {} }))
    localStorage.setItem('hedgerow:map-land-seen', Array.from({ length: 19 }, (_, i) => i + 1).join(','))
  })
  await page.reload()
  await expect(page.locator('button.node.next')).toBeVisible()
  const won = page.locator('.stop[data-state="won"]:has(button[data-level="20"])')
  await expect(won).toHaveCount(1)
  await expect(won.locator('.stop-land.bloom')).toHaveCount(1)
  await expect(page.locator('.stop[data-state="won"] .stop-land.bloom')).toHaveCount(1)
  await expect(page.locator('.stop[data-state="held"] .stop-land').first()).toBeAttached()
  await expect(page.locator('.stop[data-state="next"] .stop-land')).toHaveCount(0)
  // Seen once: the next visit draws it coloured in, without the bloom.
  await page.reload()
  await expect(page.locator('button.node.next')).toBeVisible()
  await expect(page.locator('.stop-land.bloom')).toHaveCount(0)
})

// Plan item 274: the map is a painted overworld: each act's country carries its own landmark props, settled on open
// ground, never on a stop, its name, its stars or Cath.
// Plan item 314: Hollowell's clutter round a held stop (blocks, billboards, vans) never stands on another stop's coin or
// on any stop's name: each solid shape (opacity .5+, 3 px+) is tested against the coins as circles and the names as
// boxes. Its own coin may stand in front of it.
test('plan item 314: no held-land block or billboard meets another coin or a name', async ({ page }) => {
  await seed(page, 20)
  await page.waitForTimeout(600)
  const hits = await page.evaluate(() => {
    const op = (e: Element) => {
      let o = 1
      for (let a: Element | null = e; a && a.tagName !== 'svg'; a = a.parentElement) {
        const cs = getComputedStyle(a)
        o *= Number(cs.opacity) * (a === e ? Math.max(Number(cs.fillOpacity) || 0, cs.stroke !== 'none' ? Number(cs.strokeOpacity) : 0) : 1)
      }
      return o
    }
    const stopOf = (e: Element) => e.closest('.stop')
    const coins = [...document.querySelectorAll<HTMLElement>('.stop button.node')].filter((e) => e.offsetWidth > 0).map((e) => {
      const r = e.getBoundingClientRect()
      return { stop: stopOf(e), x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }
    })
    const names = [...document.querySelectorAll<HTMLElement>('.stop .level-name')].filter((e) => e.offsetWidth > 0)
    const out: string[] = []
    for (const g of document.querySelectorAll('.stop-land .held')) {
      if (!g.getBoundingClientRect().width) continue
      const own = stopOf(g)
      for (const s of g.querySelectorAll('rect, path, circle, ellipse, polygon')) {
        const r = s.getBoundingClientRect()
        if (r.width < 3 || r.height < 3 || op(s) < 0.5) continue
        for (const c of coins) {
          if (c.stop === own) continue
          const dx = Math.max(r.left - c.x, 0, c.x - r.right)
          const dy = Math.max(r.top - c.y, 0, c.y - r.bottom)
          if (Math.hypot(dx, dy) < c.r - 2) out.push(`a ${s.tagName} on another coin`)
        }
        for (const t of names) {
          const b = t.getBoundingClientRect()
          if (r.left < b.right - 2 && b.left < r.right - 2 && r.top < b.bottom - 2 && b.top < r.bottom - 2) out.push(`a ${s.tagName} on '${t.textContent}'`)
        }
      }
    }
    return out
  })
  expect(hits).toEqual([])
})

test('plan item 274: each act shows its landmark props, clear of every stop and name', async ({ page }) => {
  await seed(page, 24)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().iterations ?? 1) === Infinity))
  await page.waitForTimeout(300)
  const acts = await page.evaluate(() => {
    const ov = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
    return [1, 2, 3, 4].map((n) => {
      const li = document.querySelector(`li.act[data-act="${n}"]`)!
      const props = [...li.querySelectorAll<HTMLElement>('.scenery .prop:not([hidden])')]
      const solids = [...li.querySelectorAll<HTMLElement>('.stop .level-name, .stop .level-num, .stop .level-stars, .stop .you, .home-spot')]
      const hits: string[] = []
      for (const p of props) {
        const pr = p.getBoundingClientRect()
        for (const s of solids) if (s.offsetWidth > 0 && ov(pr, s.getBoundingClientRect())) hits.push(`${p.dataset.prop} on ${s.className} ${s.textContent?.slice(0, 20)}`)
      }
      return { n, count: props.length, kinds: new Set(props.map((p) => p.dataset.prop)).size, hits }
    })
  })
  const wide = page.viewportSize()!.width >= 1000
  for (const a of acts) {
    expect(a.hits, `act ${a.n}`).toEqual([])
    if (wide) {
      // Act 4 is still in pencil: a short band (no card, no Cath), so fewer props find open ground.
      expect(a.count, `act ${a.n} props`).toBeGreaterThanOrEqual(a.n === 4 ? 6 : 12)
      expect(a.kinds, `act ${a.n} kinds`).toBeGreaterThanOrEqual(8)
    } else expect(a.count, `act ${a.n} props`).toBeGreaterThanOrEqual(3)
  }
})
