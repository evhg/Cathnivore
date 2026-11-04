import { expect, test, type Page } from '@playwright/test'

// CATHODE C13 (docs/design/cathode-combat.md S9): the front door. One focus for every input, fixed slots with a
// tick on each move, and starting the game is a camera move into the street: no navigation, no reload.

type Front = { cathodeFront?: { ready: boolean; ticks: number }; cathode?: { stats: { frames: number } }; marker?: number }

async function open(page: Page, touch: boolean, q = ''): Promise<void> {
  if (touch) await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto(`/nightshift/?rs=0.5${q}`)
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 120_000 })
}

test.describe('CATHODE front door', () => {
  test('the menu keeps fixed slots, wraps, ticks on every move, and Escape disarms', async ({ page, hasTouch }) => {
    test.setTimeout(180_000)
    await open(page, hasTouch)
    const items = page.locator('#menu .menu-item')
    await expect(items).toHaveCount(5)
    // No save: CONTINUE keeps its row but is off; focus starts on NEW CASE.
    await expect(page.locator('#btn-continue')).toBeDisabled()
    await expect(page.locator('#btn-begin')).toHaveClass(/is-focus/)
    const ticks = () => page.evaluate(() => (window as unknown as Front).cathodeFront!.ticks)
    const t0 = await ticks()
    await page.keyboard.press('ArrowUp')
    await expect(page.locator('#btn-credits')).toHaveClass(/is-focus/)
    await page.keyboard.press('s')
    await expect(page.locator('#btn-begin')).toHaveClass(/is-focus/)
    // Plan item 12: CASE BOARD is live on a fresh save, as a teaser: five blank prints and one open lead.
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('#btn-cases')).toHaveClass(/is-focus/)
    await expect(page.locator('#menu-hint')).toHaveText(/BEA'S WALL/)
    await page.keyboard.press('Enter')
    await expect(page.locator('.case-board')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.case-print.is-locked')).toHaveCount(5)
    await expect(page.locator('.case-list .case-flag')).toHaveText(['Open lead'])
    await expect(page.locator('.case-board .btn-primary')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('.case-board .btn-primary')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('.case-board')).toHaveCount(0, { timeout: 30_000 })
    // The menu takes focus back on the next task (main.ts openCases), so wait for it before moving.
    await expect(page.locator('#btn-cases')).toBeFocused({ timeout: 30_000 })
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('#btn-settings')).toHaveClass(/is-focus/)
    expect((await ticks()) - t0).toBe(4)
    await expect(page.locator('#menu-hint')).toHaveText(/GRAPHICS/)
    // Settings opens and Escape brings the menu back with its focus.
    await page.keyboard.press('Enter')
    await expect(page.locator('#dlg-settings')).toBeVisible({ timeout: 30_000 })
    await page.keyboard.press('Escape')
    await expect(page.locator('#dlg-settings')).toBeHidden({ timeout: 30_000 })
    await expect(page.locator('#btn-settings')).toHaveClass(/is-focus/)
    // CREDITS: who made it, nothing of the story, and Escape goes back (S9.1).
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('#btn-credits')).toHaveClass(/is-focus/)
    await page.keyboard.press('Enter')
    await expect(page.locator('.front-credits')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.front-credits')).not.toContainText(/crossed off|Gone|Silent at last/)
    await page.keyboard.press('Escape')
    await expect(page.locator('.front-credits')).toHaveCount(0, { timeout: 30_000 })
    await expect(page.locator('#btn-credits')).toHaveClass(/is-focus/)
    // Tab leaves the roving menu for the Games link, not the page body.
    await page.keyboard.press('Tab')
    await expect(page.locator('.front-back')).toBeFocused()
    // The subtitle and The List come from progress.
    await expect(page.locator('#title-sub')).toHaveText('HOLLOWELL PROPER · 2079 · 5 NAMES LEFT')
    // The next name, then the unreached ones as a count (C13T: no grey skeleton bars).
    await expect(page.locator('#the-list li')).toHaveCount(2)
    await expect(page.locator('#the-list li.is-more')).toHaveText('4 more names')
  })

  test('New Case pushes into the street and names the area, with no navigation', async ({ page, hasTouch }) => {
    test.setTimeout(400_000)
    await open(page, hasTouch, '&class=ghost')
    await page.evaluate(() => ((window as unknown as Front).marker = 7))
    await page.locator('#btn-begin').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#area-title')).toBeVisible({ timeout: 300_000 })
    await expect(page.locator('#area-name')).toHaveText('THE FISH MARKET')
    await page.waitForFunction(() => ((window as unknown as Front).cathode?.stats.frames ?? 0) >= 1, null, { timeout: 120_000 })
    // The same document: the push handed the street to the game instead of loading a page.
    expect(await page.evaluate(() => (window as unknown as Front).marker)).toBe(7)
    await expect(page.locator('#screen-title')).toBeHidden()
  })
})

// Plan item 40: on a fresh profile the gate is the front door, and the hook says so once it has painted.
test('cathodeFront.ready fires at the 18+ gate on a fresh profile', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/nightshift/?rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 120_000 })
  await expect(page.locator('#screen-gate')).toBeVisible()
})

// Plan item 74: at the gate the focus dash keeps a gutter from the screen's edge, every line of the plate is
// inside the viewport, and the loading line is a real line (at least 2 px by 150 px), not a hairline.
test('the 18+ gate keeps its marks off the screen edge, and the loading line is legible', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/nightshift/?rs=0.5')
  await expect(page.locator('#screen-gate')).toBeVisible({ timeout: 120_000 })
  const r = await page.evaluate(() => {
    const tile = document.querySelector('.gate-tile')!
    const t = tile.getBoundingClientRect()
    const dashLeft = t.left + parseFloat(getComputedStyle(tile, '::before').left)
    const plate = [...document.querySelectorAll<HTMLElement>('#screen-gate .gate-plate *')].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0)
    // The boot line leaves the page once the street is built (plan item 89); its size while it shows is what counts.
    const line = document.getElementById('front-building')!
    line.hidden = false
    const bar = line.getBoundingClientRect()
    return { dashLeft, minLeft: Math.min(...plate.map((b) => b.left)), maxRight: Math.max(...plate.map((b) => b.right)), barW: bar.width, barH: bar.height }
  })
  expect(r.dashLeft).toBeGreaterThanOrEqual(8)
  expect(r.minLeft).toBeGreaterThanOrEqual(8)
  expect(r.maxRight).toBeLessThanOrEqual(page.viewportSize()!.width - 8)
  expect(r.barH).toBeGreaterThanOrEqual(2)
  expect(r.barW).toBeGreaterThanOrEqual(150)
})

// Plan item 40: the critique's front-door bugs. The class-pick still shows no title menu under it; on an upright
// phone the hold bar is pinned on screen with a "more below" cue that goes once the sheet is read to its end;
// held sideways, the case board shows its first lead and Back on the first screen.
test.describe('CATHODE front door fits (plan item 40)', () => {
  test('class pick: no menu under the still, and the phone pins the hold bar with a scroll cue', async ({ page, hasTouch }) => {
    test.setTimeout(180_000)
    if (hasTouch) await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/nightshift/?shot')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
    await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 120_000 })
    await expect(page.locator('#screen-title')).toBeHidden()
    const hold = page.locator('.cp-hold')
    await expect(hold).toBeVisible()
    const vh = page.viewportSize()!.height
    const box = await hold.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 1)
    if (!hasTouch) return
    // The sheet runs past the fold: the cue shows, and goes once scrolled to the end.
    await expect(page.locator('.cp')).toHaveClass(/cp-more/)
    await expect(page.locator('.cp-cue')).toHaveText(/more below/i)
    await expect.poll(() => page.locator('.cp-cue').evaluate((e) => Number(getComputedStyle(e).opacity))).toBeGreaterThan(0.9)
    await page.evaluate(() => {
      const cp = document.querySelector('.cp')!
      cp.scrollTop = cp.scrollHeight
    })
    await expect(page.locator('.cp')).not.toHaveClass(/cp-more/)
    await expect.poll(() => page.locator('.cp-cue').evaluate((e) => Number(getComputedStyle(e).opacity))).toBeLessThan(0.1)
    // At the end, the last of the sheet (the skill trees) sits above the pinned bar, not under it.
    const last = await page.locator('.cp-tree').last().boundingBox()
    const bar = await page.locator('.cp-foot').boundingBox()
    expect(last!.y + last!.height).toBeLessThanOrEqual(bar!.y + 26)
  })

  test('case board held sideways: the first lead and Back show on the first screen', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'the sideways phone')
    test.setTimeout(180_000)
    await open(page, true)
    await page.locator('#btn-cases').click()
    await expect(page.locator('.case-board')).toBeVisible({ timeout: 30_000 })
    for (const sel of ['.case-list li >> nth=0', '.case-board .btn-primary']) {
      const b = await page.locator(sel).boundingBox()
      expect(b, sel).not.toBeNull()
      expect(b!.y + b!.height, sel).toBeLessThanOrEqual(391)
      expect(b!.y, sel).toBeGreaterThanOrEqual(0)
    }
  })
})

// Plan item 69: the office load is Cath's office over the office's own key art, not Crisp's market file.
test('the office loading card names the office over its own key art, inside the viewport', async ({ page }) => {
  // The name waits up to 120 s for a cold build under a loaded runner; the test's own budget has to cover that.
  test.setTimeout(180_000)
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=loading-office&shot')
  const name = page.locator('#loading:not([hidden]) .ld-name')
  await expect(name).toHaveText('Cath’s office', { timeout: 120_000 })
  await expect(page.locator('#loading .ld-place')).toContainText('BETWEEN CASES')
  expect(await page.locator('#loading .ld-img').evaluate((e) => getComputedStyle(e).backgroundImage)).toMatch(/keyart\/office\.webp/)
  const vp = page.viewportSize()!
  for (const sel of ['.ld-name', '.ld-lore', '.ld-corner']) {
    const b = (await page.locator(`#loading ${sel}`).boundingBox())!
    expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1, sel).toBe(true)
  }
})

// Plan item 82: no letterbox on the front door. The street runs full-bleed; the 2.39:1 bars read as dead black
// bands (42 px at P, 45 px at D).
test('the front door has no letterbox bars at P and D', async ({ page }) => {
  test.setTimeout(120_000)
  for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(vp)
    await page.goto('/nightshift/?shot')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?front=title&shot&quality=phone')
    const bands = await page.evaluate(() =>
      [...document.querySelectorAll('#front-bars i')].map((i) => Math.round(i.getBoundingClientRect().height)),
    )
    expect(bands.every((h) => h <= 8), `bands ${bands.join(',')} at ${vp.width}`).toBe(true)
  }
})

// Plan item 82: on an upright phone she stands in the lower right, clear of the menu (she stood behind it).
test('upright, the menu does not cover her', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the upright phone framing')
  test.setTimeout(200_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const m = await page.evaluate(() => {
    const menu = document.querySelector('#menu')!.getBoundingClientRect()
    const scene = (window as unknown as { cathodeFront: { scene(): { figureBox(): { left: number; top: number; right: number; bottom: number } } | null } }).cathodeFront.scene()
    return { menu: { left: menu.left, top: menu.top, right: menu.right, bottom: menu.bottom }, fig: scene!.figureBox() }
  })
  const overlap = m.fig.left < m.menu.right && m.fig.right > m.menu.left && m.fig.top < m.menu.bottom && m.fig.bottom > m.menu.top
  expect(overlap, JSON.stringify(m)).toBe(false)
  // She stands in the lower half of the frame.
  expect((m.fig.top + m.fig.bottom) / 2).toBeGreaterThan(844 / 2)
})

// Plan item 82: the logotype holds at least 4.5:1 against the street behind it at P and D (the 95th-percentile
// brightest pixel behind its box, with the logotype hidden).
test('the logotype reads at 4.5:1 or more against the street behind it', async ({ page }) => {
  test.setTimeout(300_000)
  for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(vp)
    await page.goto('/nightshift/?shot')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
    await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().iterations ?? 1) === Infinity))
    const box = (await page.locator('.logo-svg').boundingBox())!
    const ink = await page.evaluate(() => getComputedStyle(document.querySelector('.logo-text')!).fill)
    await page.addStyleTag({ content: '.logo-svg { visibility: hidden !important; }' })
    const shot = (await page.screenshot({ clip: box })).toString('base64')
    const ratio = await page.evaluate(async ([png, fill]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${png}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
      const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      const ls: number[] = []
      for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i]!, d[i + 1]!, d[i + 2]!))
      ls.sort((a, b) => a - b)
      const bg = ls[Math.floor(ls.length * 0.95)]!
      const [r, g, b] = fill.match(/\d+/g)!.map(Number)
      return (lum(r!, g!, b!) + 0.05) / (bg + 0.05)
    }, [shot, ink] as const)
    expect(ratio, `contrast at ${vp.width}`).toBeGreaterThanOrEqual(4.5)
  }
})

// Plan item 89: at D the List is five pinned mugshots, each 64 px tall or more, the next one marked.
test('at D the List is five mugshots', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop front menu')
  test.setTimeout(200_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const mugs = page.locator('#the-list-wall .mug')
  await expect(mugs).toHaveCount(5)
  for (const h of await page.locator('#the-list-wall .mug-photo').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(64)
  await expect(page.locator('#the-list-wall .mug.is-next')).toHaveCount(1)
  // The names list stays, for screen readers and phones.
  await expect(page.locator('#the-list li').first()).toBeAttached()
})

// Plan item 89: at D, New Case (with the focus on a fresh profile) slides in its case file beside the menu.
test('at D the focused New Case shows its dossier', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop front menu')
  test.setTimeout(200_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const dossier = page.locator('#dossier.is-open')
  await expect(dossier).toBeVisible()
  await expect(dossier.locator('.dossier-target')).toHaveText('Tomas Reed')
  const d = (await page.locator('#dossier').boundingBox())!
  // Clear of the menu's words and its hint line (their text, not their column-wide boxes), and inside the frame.
  const textRight = await page.evaluate(() => {
    let right = 0
    for (const e of document.querySelectorAll('#menu .menu-label, #menu-hint')) {
      const r = document.createRange()
      r.selectNodeContents(e)
      for (const b of r.getClientRects()) right = Math.max(right, b.right)
    }
    return right
  })
  expect(d.x).toBeGreaterThanOrEqual(textRight)
  expect(d.x + d.width).toBeLessThanOrEqual(1440)
  // Settings has no case file: the dossier slides away.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#dossier.is-open')).toHaveCount(0)
})

// Plan item 89: the loading line is gone once the title is up (a frozen frame held it under the menu).
test('the boot line leaves the title once it is built', async ({ page }) => {
  test.setTimeout(200_000)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  await expect(page.locator('#front-building')).toBeHidden()
})

// Plan item 89: at D every menu entry reads at 4.5:1 or more against the street behind it.
test('at D the menu entries read at 4.5:1 or more', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop front menu')
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  for (const id of ['btn-begin', 'btn-cases', 'btn-settings', 'btn-credits']) {
    const item = page.locator(`#${id}`)
    const box = (await item.boundingBox())!
    const ink = await item.evaluate((e) => { const s = getComputedStyle(e); return { c: s.color, o: Number(s.opacity) } })
    await item.evaluate((e) => ((e as HTMLElement).style.visibility = 'hidden'))
    const shot = (await page.screenshot({ clip: box })).toString('base64')
    await item.evaluate((e) => ((e as HTMLElement).style.visibility = ''))
    const ratio = await page.evaluate(async ([png, c, o]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${png}`
      await img.decode()
      const cv = document.createElement('canvas')
      cv.width = img.width
      cv.height = img.height
      const x = cv.getContext('2d')!
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, cv.width, cv.height).data
      const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
      const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      const ls: number[] = []
      for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i]!, d[i + 1]!, d[i + 2]!))
      ls.sort((a, b) => a - b)
      const bg = ls[Math.floor(ls.length * 0.9)]!
      const [r, g, b] = c.match(/[\d.]+/g)!.map(Number)
      const text = lum(r!, g!, b!) * o + bg * (1 - o)
      return (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05)
    }, [shot, ink.c, ink.o] as const)
    expect(ratio, id).toBeGreaterThanOrEqual(4.5)
  }
})

// Plan item 99: every List photo and the dossier's is a painted mugshot, not a flat fill (luminance spread over 12),
// the dossier photo 140 px wide or more at D and the List frames 56 px or more on an upright phone.
test('the List and the dossier are painted mugshots', async ({ page, hasTouch }) => {
  test.setTimeout(240_000)
  if (hasTouch) await page.setViewportSize({ width: 390, height: 844 })
  else await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const photos = page.locator(hasTouch ? '#the-list-wall .mug-photo' : '#the-list-wall .mug-photo, #dossier .dossier-photo')
  const n = await photos.count()
  expect(n).toBeGreaterThanOrEqual(5)
  for (let i = 0; i < n; i++) {
    const ph = photos.nth(i)
    const box = (await ph.boundingBox())!
    if (hasTouch) expect(box.width).toBeGreaterThanOrEqual(56)
    const png = (await page.screenshot({ clip: box })).toString('base64')
    const sd = await page.evaluate(async (b64) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      const ls: number[] = []
      for (let k = 0; k < d.length; k += 4) ls.push(0.2126 * d[k]! + 0.7152 * d[k + 1]! + 0.0722 * d[k + 2]!)
      const mean = ls.reduce((a, b) => a + b, 0) / ls.length
      return Math.sqrt(ls.reduce((a, b) => a + (b - mean) ** 2, 0) / ls.length)
    }, png)
    expect(sd, `photo ${i}`).toBeGreaterThan(12)
  }
  if (!hasTouch) expect((await page.locator('#dossier .dossier-photo').boundingBox())!.width).toBeGreaterThanOrEqual(140)
})

// Plan item 99: the List's and the dossier's captions read at 4.5:1 or more against their print (shot with the
// caption hidden, the print's own paper behind it).
test('the mugshot captions read at 4.5:1 or more', async ({ page, hasTouch }) => {
  test.setTimeout(240_000)
  await page.setViewportSize(hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const sel = hasTouch ? '#the-list-wall .mug-name' : '#the-list-wall .mug-name, #dossier :is(.dossier-kicker, .dossier-target, .dossier-place, .dossier-tag)'
  const caps = page.locator(sel)
  const n = await caps.count()
  expect(n).toBeGreaterThanOrEqual(5)
  for (let i = 0; i < n; i++) {
    const cap = caps.nth(i)
    if (!(await cap.isVisible())) continue
    const box = (await cap.boundingBox())!
    const ink = await cap.evaluate((e) => getComputedStyle(e).color)
    const before = await cap.evaluate((e) => { const s = (e as HTMLElement).style.color; (e as HTMLElement).style.color = 'transparent'; return s })
    const png = (await page.screenshot({ clip: box })).toString('base64')
    await cap.evaluate((e, s) => ((e as HTMLElement).style.color = s), before)
    const ratio = await page.evaluate(async ([b64, c]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const cv = document.createElement('canvas')
      cv.width = img.width
      cv.height = img.height
      const x = cv.getContext('2d')!
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, cv.width, cv.height).data
      const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
      const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      const ls: number[] = []
      for (let k = 0; k < d.length; k += 4) ls.push(lum(d[k]!, d[k + 1]!, d[k + 2]!))
      ls.sort((a, b) => a - b)
      const bg = ls[Math.floor(ls.length * 0.5)]!
      const [r, g, b] = c.match(/[\d.]+/g)!.map(Number)
      const t = lum(r!, g!, b!)
      return (Math.max(t, bg) + 0.05) / (Math.min(t, bg) + 0.05)
    }, [png, ink] as const)
    expect(ratio, `caption ${i}`).toBeGreaterThanOrEqual(4.5)
  }
})
