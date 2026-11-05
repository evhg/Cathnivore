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
    // Tab leaves the roving menu for the next control, not the page body: The List's prints (tab stops since item
    // 169) or the Games link.
    await page.keyboard.press('Tab')
    await expect
      .poll(() => page.evaluate(() => { const a = document.activeElement; return !!a && a !== document.body && !!a.closest('.front-back, li.mug') }))
      .toBe(true)
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
  test('class pick: no menu under the still, and the phone pins the hold bar on one screen', async ({ page, hasTouch }) => {
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
    // Plan item 125 replaced item 40's scroll: the whole file fits one screen, so there is no 'more below' cue,
    // and the last of the sheet (the skill trees) sits above the pinned bar, not under it.
    await expect(page.locator('.cp')).not.toHaveClass(/cp-more/)
    expect(await page.locator('.cp').evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1)
    await expect.poll(() => page.locator('.cp-cue').evaluate((e) => (getComputedStyle(e).display === 'none' ? 0 : Number(getComputedStyle(e).opacity)))).toBeLessThan(0.1)
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

// Plan item 82: on an upright phone she stood in the lower right, clear of the menu. Plan item 148 frames her whole
// on the title instead, umbrella to shoes, down the right above The List's photo strip: her figure inside the
// viewport and meeting no polaroid, her face meeting no menu entry, the scene's key light named on the canvas, and
// the neon blade behind her with its backlit rain.
test('upright, she stands whole above The List, her face clear of the menu', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the upright phone framing')
  test.setTimeout(200_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  await expect(page.locator('canvas[data-key-light="neon"]')).toHaveCount(1)
  type B = { left: number; top: number; right: number; bottom: number }
  const m = await page.evaluate(() => {
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }
    const scene = (window as unknown as { cathodeFront: { scene(): { figureBox(): B; faceBox(): B } | null } }).cathodeFront.scene()
    return {
      rows: [...document.querySelectorAll('#menu button, #menu a')].map(box).filter((r) => r.right > r.left),
      mugs: [...document.querySelectorAll('#the-list-wall .mug')].map(box).filter((r) => r.right > r.left),
      fig: scene!.figureBox(),
      face: scene!.faceBox(),
      // Plan item 148: the neon blade's middle on screen, and its backlit rain.
      neon: (() => {
        type V = { clone(): V; project(c: unknown): V; x: number; y: number }
        type O = { name: string; position: V; getWorldPosition(v: V): V; geometry?: { instanceCount?: number } }
        const w = (scene as unknown as { world: { camera: unknown; scene: { getObjectByName(n: string): O | undefined } } }).world
        const g = w.scene.getObjectByName('front-neon')!
        const v = g.getWorldPosition(g.position.clone()).project(w.camera)
        const rain = w.scene.getObjectByName('front-neon-rain')
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, drops: rain?.geometry?.instanceCount ?? 0 }
      })(),
    }
  })
  const hits = (a: B, b: B) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  expect(m.mugs.length).toBeGreaterThan(0)
  expect(m.fig.top, JSON.stringify(m.fig)).toBeGreaterThanOrEqual(0)
  expect(m.fig.left).toBeGreaterThanOrEqual(0)
  expect(m.fig.right).toBeLessThanOrEqual(390)
  expect(m.fig.bottom).toBeLessThanOrEqual(844)
  for (const mug of m.mugs) expect(hits(m.fig, mug), JSON.stringify({ fig: m.fig, mug })).toBe(false)
  for (const r of m.rows) expect(hits(m.face, r), JSON.stringify({ face: m.face, r })).toBe(false)
  // Whole, but not small: she fills most of the screen above the strip.
  expect(m.fig.bottom - m.fig.top).toBeGreaterThan(560)
  // Plan item 148: the sign steps in behind her (it hangs off the right edge in the landscape framings), its middle
  // inside her figure's width and her top half, off every menu entry; rain falls through its light.
  expect(m.neon.x, JSON.stringify(m.neon)).toBeGreaterThan(m.fig.left)
  expect(m.neon.x).toBeLessThan(m.fig.right)
  expect(m.neon.y).toBeGreaterThan(m.fig.top)
  expect(m.neon.y).toBeLessThan((m.fig.top + m.fig.bottom) / 2)
  for (const r of m.rows) expect(m.neon.x > r.left && m.neon.x < r.right && m.neon.y > r.top && m.neon.y < r.bottom).toBe(false)
  expect(m.neon.drops).toBeGreaterThan(100)
})

// Plan item 159: the menu is a sign: a shut slot says why (aria-disabled, a visible reason), the lit row follows the
// arrow keys within 250 ms, and upright the plate stays clear of her body (the umbrella's canopy aside).
test('the front menu is a sign: lit by the keys, a shut slot says why, clear of her upright', async ({ page, hasTouch }) => {
  test.setTimeout(200_000)
  const upright = hasTouch
  await page.setViewportSize(upright ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })) })
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const cont = page.locator('#btn-continue')
  await expect(cont).toHaveAttribute('aria-disabled', 'true')
  await expect(cont.locator('.menu-why')).toBeVisible()
  await expect(cont.locator('.menu-why')).toHaveText('No case open')
  await expect(page.locator('#menu')).toHaveAttribute('data-lit', 'new')
  await page.locator('#btn-begin').focus()
  for (const next of ['cases', 'settings']) {
    const t0 = Date.now()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('#menu')).toHaveAttribute('data-lit', next, { timeout: 250 })
    expect(Date.now() - t0).toBeLessThan(400)
    await expect(page.locator(`#menu [data-slot="${next}"]`)).toHaveAttribute('data-lit', '')
  }
  if (upright) {
    type B = { left: number; top: number; right: number; bottom: number }
    const m = await page.evaluate(() => {
      const r = document.getElementById('menu')!.getBoundingClientRect()
      const scene = (window as unknown as { cathodeFront: { scene(): { figureBox(body?: boolean): B } | null } }).cathodeFront.scene()
      return { menu: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, body: scene!.figureBox(true) }
    })
    const hits = m.menu.left < m.body.right && m.menu.right > m.body.left && m.menu.top < m.body.bottom && m.menu.bottom > m.body.top
    expect(hits, JSON.stringify(m)).toBe(false)
    expect(m.menu.left).toBeGreaterThanOrEqual(0)
    // Plan item 177: the plate hangs in from the screen's edge, and the lit row's neon mark sits on the plate.
    expect(m.menu.left).toBeGreaterThanOrEqual(4)
    const mark = await page.locator('#menu .menu-item.is-focus').evaluate((e) => {
      const r = e.getBoundingClientRect()
      return r.left + parseFloat(getComputedStyle(e, '::before').left)
    })
    expect(mark).toBeGreaterThanOrEqual(m.menu.left + 2)
  }
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
      // A color-mix() computes to color(srgb r g b) with 0-1 channels (plan item 159's lit row).
      const [r, g, b] = c.match(/[\d.]+/g)!.map(Number).map((v: number) => (c.startsWith('color(') ? v * 255 : v))
      const text = lum(r!, g!, b!) * o + bg * (1 - o)
      return (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05)
    }, [shot, ink.c, ink.o] as const)
    expect(ratio, `${id} ${JSON.stringify(ink)}`).toBeGreaterThanOrEqual(4.5)
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

// Plan item 107: the List's prints carry no words under 11 px (their slates and REDACTED bars were 4-5 px), and a
// withheld print fades only its photo, so 'Withheld' isn't dimmed with it.
test('the List prints have no unreadable words, and Withheld is not faded', async ({ page, hasTouch }) => {
  test.setTimeout(240_000)
  await page.setViewportSize(hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const r = await page.evaluate(() => {
    const wall = document.getElementById('the-list-wall')!
    const tiny = [...wall.querySelectorAll('svg text')].filter((t) => t.getBoundingClientRect().height < 11).map((t) => t.textContent)
    const faded = [...wall.querySelectorAll<HTMLElement>('.mug')].filter((m) => parseFloat(getComputedStyle(m).opacity) < 1).length
    return { tiny, faded, sealed: wall.querySelectorAll('.mug.is-sealed').length }
  })
  expect(r.sealed).toBeGreaterThan(0)
  expect(r.tiny).toEqual([])
  expect(r.faded).toBe(0)
})

// Plan item 117: the face of every game is seen from the front. On the title the lens circles her left front, her
// face 120 px or more tall at D and 70 at P (66 since item 148's whole figure), and on an upright phone it meets no menu entry.
test("her face reads on the title, clear of the menu", async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  const vp = hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 }
  await page.setViewportSize(vp)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  for (const t of [8, 26]) {
    await page.goto(`/nightshift/?front=title&shot&t=${t}&quality=phone`)
    await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
    const m = await page.evaluate(() => {
      type B = { left: number; top: number; right: number; bottom: number }
      const scene = (window as unknown as { cathodeFront: { scene(): { faceBox(): B } | null } }).cathodeFront.scene()
      const rows = [...document.querySelectorAll('#menu button, #menu a')].map((e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }).filter((r) => r.right > r.left)
      return { face: scene!.faceBox(), rows }
    })
    // Plan item 148: 66 at P, where she now stands whole (umbrella to shoes) above The List (70 as a half figure).
    expect(m.face.bottom - m.face.top, `t=${t}`).toBeGreaterThanOrEqual(hasTouch ? 66 : 120)
    expect(m.face.top).toBeGreaterThanOrEqual(0)
    expect(m.face.right).toBeLessThanOrEqual(vp.width)
    for (const r of m.rows) expect(m.face.left < r.right && m.face.right > r.left && m.face.top < r.bottom && m.face.bottom > r.top, JSON.stringify({ face: m.face, r })).toBe(false)
    // Plan item 140: the title shows her smirk, lit by a warm face key (the face's mean luminance was 0.12 at P and
    // 0.16 at D under the flat pink wash; about 0.18 and 0.22 with it) with rose lips that read as a hue.
    await expect(page.locator('canvas[data-expression]').first()).toHaveAttribute('data-expression', 'smirk')
    if (t === 8) {
      // ?shot draws its held frame a moment after ready (the face canvas uploads on the first draw).
      await page.waitForTimeout(3000)
      const f = m.face
      const buf = await page.screenshot({ clip: { x: f.left, y: f.top, width: f.right - f.left, height: f.bottom - f.top } })
      const px = await page.evaluate(async (b64) => {
        const img = new Image()
        img.src = 'data:image/png;base64,' + b64
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const g = c.getContext('2d')!
        g.drawImage(img, 0, 0)
        const d = g.getImageData(0, 0, c.width, c.height).data
        let mean = 0
        let rose = 0
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i]! / 255, gr = d[i + 1]! / 255, b = d[i + 2]! / 255
          mean += 0.2126 * r + 0.7152 * gr + 0.0722 * b
          const mx = Math.max(r, gr, b), mn = Math.min(r, gr, b)
          if (mx - mn > 0.15 && r === mx && mx > 0.35) {
            const h = (((gr - b) / (mx - mn)) * 60 + 360) % 360
            if (h >= 330 || h <= 15) rose++
          }
        }
        return { mean: mean / (d.length / 4), rose }
      }, buf.toString('base64'))
      // Plan item 148: the noir poster's lit face, 0.25 or more at D.
      expect(px.mean, 'the warm key lights her face').toBeGreaterThanOrEqual(hasTouch ? 0.17 : 0.25)
      expect(px.rose, 'rose lips').toBeGreaterThanOrEqual(40)
    }
  }
})

// Plan item 147: the title's Cath is the hero model (a tailored, flared trench, gloved fingers on the umbrella and
// the cigarette, long hair that moves), and her silhouette stands 300 px or taller on the desktop title.
test('the title Cath is the hero model, 300 px or taller at D', async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  const vp = hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 }
  await page.setViewportSize(vp)
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  await expect(page.locator('canvas[data-cath-lod]').first()).toHaveAttribute('data-cath-lod', 'hero')
  const m = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).cathodeFront.scene().world
    const g = w.scene.getObjectByName('front-cath')
    const names = ['cath-fist-r', 'cath-hand-l'].filter((n) => !!g?.getObjectByName(n))
    const box = { top: Infinity, bottom: -Infinity }
    g.updateWorldMatrix(true, true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g.traverse((o: any) => {
      if (!o.isMesh || !o.geometry) return
      o.geometry.computeBoundingBox()
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)
      for (const y of [bb.min.y, bb.max.y]) {
        const v = bb.min.clone().setY(y)
        v.x = (bb.min.x + bb.max.x) / 2
        v.z = (bb.min.z + bb.max.z) / 2
        v.project(w.camera)
        const sy = ((1 - v.y) / 2) * innerHeight
        box.top = Math.min(box.top, sy)
        box.bottom = Math.max(box.bottom, sy)
      }
    })
    return { names, top: Math.max(0, box.top), bottom: Math.min(innerHeight, box.bottom) }
  })
  expect(m.names).toEqual(['cath-fist-r', 'cath-hand-l'])
  if (!hasTouch) expect(m.bottom - m.top, 'her silhouette on screen').toBeGreaterThanOrEqual(300)
})
