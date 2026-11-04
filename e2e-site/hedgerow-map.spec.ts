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
  test(`plan item 18: the fog rolls back off a newly opened act once${reduced ? ' (a fade under reduced motion)' : ''}`, async ({ page }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    await seed(page, 9)
    await expect(page.locator('.unveil-fog')).toHaveCount(0)
    // Act 1's boss falls; the next time the map shows, act 2 opens under rolling fog.
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('hedgerow:v1')!)
      d.stars['10'] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify(d))
    })
    await page.reload()
    const fog = page.locator('li.act-unveil .unveil-fog')
    await expect(fog).toHaveCount(1)
    await expect(page.locator('li.act-unveil')).toHaveAttribute('data-act', '2')
    await expect(fog).toHaveCSS('animation-name', reduced ? 'fog-fade' : 'fog-roll')
    // It clears itself, and doesn't play again.
    await expect(fog).toHaveCount(0, { timeout: 6000 })
    await page.reload()
    await expect(page.locator('button.node.next')).toBeVisible()
    await expect(page.locator('.unveil-fog')).toHaveCount(0)
  })
}

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
test('plan item 73: every stop is a landmark vignette, 44 px or larger, grey while locked', async ({ page }) => {
  await seed(page, 6)
  // The stops scale in as the map opens; measure them at rest.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().iterations ?? 1) === Infinity))
  const nodes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>('button.node')].slice(0, 10).map((b) => {
      const coin = b.querySelector('.level-num')!.getBoundingClientRect()
      const mark = b.querySelector('.level-num .level-landmark')
      return { w: coin.width, h: coin.height, mark: !!mark, badge: b.querySelector('.level-num .level-n')?.textContent, locked: b.disabled, grey: mark ? getComputedStyle(mark).filter.includes('grayscale(1)') : false }
    }),
  )
  expect(nodes).toHaveLength(10)
  nodes.forEach((n, i) => {
    expect(Math.min(n.w, n.h), `node ${i + 1}`).toBeGreaterThanOrEqual(44)
    expect(n.mark).toBe(true)
    expect(n.badge).toBe(String(i + 1))
    expect(n.grey).toBe(n.locked)
  })
})

test('plan item 73: the next act is a named glimpse of its country, not fog', async ({ page }) => {
  await seed(page, 0)
  const glimpse = page.locator('li.act-fog.act-glimpse')
  await expect(glimpse).toBeVisible()
  await expect(glimpse.locator('.act-fog-text strong')).toHaveText('Highmoor')
  await expect(glimpse.locator('.act-fog-kicker')).toContainText('Act 2')
  const scene = await glimpse.locator('.act-fog-scene').evaluate((e) => ({ filter: getComputedStyle(e).filter, opacity: Number(getComputedStyle(e).opacity) }))
  expect(scene.filter).not.toContain('blur')
  expect(scene.opacity).toBeGreaterThanOrEqual(0.85)
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
      you: r('button.node[data-level="21"] .you').bottom,
      coin: r('button.node[data-level="21"] .level-num').top,
      lock: r('button.node[data-level="30"] .level-lock').bottom,
      name: r('button.node[data-level="30"] .level-name').top,
    }
  })
  expect(m.coin - m.you).toBeGreaterThanOrEqual(4)
  if ((page.viewportSize()?.width ?? 0) >= 600) expect(m.name - m.lock).toBeGreaterThanOrEqual(3)
})

test('plan item 91: the lane into the next act leaves from under the last stop shown', async ({ page }) => {
  await seed(page, 13)
  await page.waitForFunction(() => !!document.querySelector('.act-fog-lane'))
  await page.evaluate(() => document.fonts.ready)
  const m = await page.evaluate(() => {
    const lane = document.querySelector('.act-fog-lane')!.getBoundingClientRect()
    const nums = [...document.querySelectorAll('.stop .level-num')]
    const last = nums[nums.length - 1]!.getBoundingClientRect()
    return { lane: lane.left + lane.width / 2, stop: last.left + last.width / 2 }
  })
  expect(Math.abs(m.lane - m.stop)).toBeLessThanOrEqual(12)
})

test('plan item 88: at D the next act is a strip of 120 px or less', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop map')
  await seed(page, 13)
  const glimpse = page.locator('li.act-fog.act-glimpse')
  await expect(glimpse).toBeVisible()
  expect((await glimpse.boundingBox())!.height).toBeLessThanOrEqual(120)
  await expect(glimpse.locator('.act-fog-text strong')).toBeVisible()
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
  await expect(card.locator('.lcard-thumb svg')).toBeVisible()
  // Focusing another open stop shows it on the card.
  await page.locator('button.node[data-level="12"]').focus()
  await expect(card.locator('.lcard-name')).toHaveText('Cheap Eggs')
  await expect(play).toHaveText('Play again')
  await page.locator('button.node[data-level="14"]').focus()
  await play.click()
  // A stop not seen before opens its story first, then the field.
  await expect(page.locator('#screen-play:not([hidden]), #story-scene:visible').first()).toBeVisible({ timeout: 15_000 })
})
