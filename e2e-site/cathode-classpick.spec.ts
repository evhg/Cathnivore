import { expect, test, type Page } from './own-gpu'

// Plan item 112: the class pick shows Cath's face. A `?play` link on a fresh save builds the street behind the
// case file and turns her to the camera in each class's look; the stats sit on a dark dossier plate; on an
// upright phone the names are 15 px and (plan item 125) the whole file fits one screen.

type Box = { left: number; top: number; right: number; bottom: number }
type Front = { cathodeFront?: { ready: boolean; scene: () => { dressed: string | null; kit: string | null; figureBox(): Box } | null } }

const CLASSES = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']

/** Picks a class the way the layout offers it: the names' rack at D, the page dots on an upright phone (item 245). */
async function pick(page: Page, cls: string, hasTouch: boolean): Promise<void> {
  await page.locator(`${hasTouch ? '.cp-dot' : '.cp-opt'}[data-cls=${cls}]`).click()
}

async function fresh(page: Page, hasTouch: boolean): Promise<void> {
  await page.setViewportSize(hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
}

test('a ?play case file turns Cath to the camera, in a different look for each class', async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  const dressed = () => page.evaluate(() => (window as unknown as Front).cathodeFront?.scene()?.dressed ?? null)
  await expect.poll(dressed, { timeout: 200_000 }).toBe('ghost')
  const seen = new Set<string>()
  // Plan item 140: her painted face changes with the class (the ghost set, the wirewitch winking).
  const faces: Record<string, string | null> = {}
  const pieces: Record<string, string> = {}
  for (const cls of CLASSES) {
    await pick(page, cls, hasTouch)
    await expect.poll(dressed, { timeout: 30_000 }).toBe(cls)
    faces[cls] = await page.locator('canvas[data-expression]').first().getAttribute('data-expression')
    // Each class's own kit over the coat (the rifle sling, the apron, the holster, the wire rig, the tie).
    seen.add(`${await dressed()}/${await page.evaluate(() => (window as unknown as Front).cathodeFront!.scene()!.kit)}`)
    // Plan item 434: and her outline changes with it (the Ghost's hood, the Gunslinger's hat and caped duster, the
    // Wirewitch's cable halo, the Fixer's briefcase): the kit pieces shown are each class's own.
    pieces[cls] = await page.evaluate(() => {
      const names: string[] = []
      const g = (window as unknown as { cathodeFront: { scene: () => { cath: { group: { traverse(f: (o: { name: string; visible: boolean; parent: unknown }) => void): void } } } } }).cathodeFront.scene().cath.group
      g.traverse((o) => {
        if (!/^kit-/.test(o.name) || !o.visible) return
        for (let q = o.parent as { visible: boolean; parent: unknown } | null; q; q = q.parent as typeof q) if (!q.visible) return
        names.push(o.name)
      })
      return names.sort().join(',')
    })
  }
  expect(new Set(Object.values(pieces)).size, JSON.stringify(pieces)).toBe(CLASSES.length)
  expect(pieces.gunslinger).toContain('kit-gunslinger-cape-extra')
  expect([...seen]).toEqual(CLASSES.map((c) => `${c}/${c}`))
  expect(faces).toEqual({ ghost: 'determined', butcher: 'determined', gunslinger: 'smirk', wirewitch: 'wink', fixer: 'smirk' })
  // Her figure, head to hem, is a presence: 420 px or more at D, 300 at P.
  const fig = await page.evaluate(() => (window as unknown as Front).cathodeFront!.scene()!.figureBox())
  expect(fig.bottom - fig.top, JSON.stringify(fig)).toBeGreaterThanOrEqual(hasTouch ? 300 : 420)
})

test('the stat sheet reads at 4.5:1 on its plate; the phone names are 15 px and the file fits one screen', async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  // Plan item 313: with the street up, the case table shows the class's gun lit (item 199's line art is the fallback).
  await expect(page.locator('.cp-weapon-art.is-lit .cp-gun')).toHaveCount(1)
  const box = (await page.locator('.cp-attrs').boundingBox())!
  const ink = await page.evaluate(() => getComputedStyle(document.querySelector('.cp-attr dt')!).color)
  await page.addStyleTag({ content: '.cp-attrs { visibility: hidden !important; }' })
  const png = (await page.screenshot({ clip: box })).toString('base64')
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
    // Either way round (plan item 210's phone dossier is dark ink on paper).
    const t = lum(r!, g!, b!)
    return (Math.max(t, bg) + 0.05) / (Math.min(t, bg) + 0.05)
  }, [png, ink] as const)
  expect(ratio).toBeGreaterThanOrEqual(4.5)
  await page.addStyleTag({ content: '.cp-attrs { visibility: visible !important; }' })
  if (!hasTouch) return
  // Plan item 245: no row of names shows; a page tab per class (the names' row stays in the DOM for keyboards and
  // screen readers). Plan item 397: the class is named once, on the open tab (the big title went); the three skill
  // trees are rows with their effect; the stats are bars marked with the other classes and the average.
  const plate = await page.evaluate(() => {
    const n = document.querySelector<HTMLElement>('.cp-dot.is-on .cp-dot-name')!
    const r = n.getBoundingClientRect()
    const list = document.querySelector('.cp-list')!.getBoundingClientRect()
    const shown = (e: Element) => (e as HTMLElement).offsetParent !== null && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden'
    const ghosts = [...document.querySelectorAll('.cp *')].filter((e) => !e.closest('.cp-list') && shown(e) && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim().toLowerCase() === 'ghost')).length
    const rows = [...document.querySelectorAll('.cp-sheet .skill-row')].map((row) => {
      const fx = row.querySelector<HTMLElement>('.cp-tree-theme')!
      return { text: fx.textContent!.trim(), size: parseFloat(getComputedStyle(fx).fontSize), shown: shown(fx) }
    })
    const art = document.querySelector('.cp-weapon-art')!.getBoundingClientRect()
    const panel = document.querySelector('.cp-weapon')!.getBoundingClientRect()
    // Plan item 559: each stat reads her lead over the average ('+7', 14 px or more), not item 397's 6 px ticks.
    const marks = [...document.querySelectorAll('.cp-attr')].map((a) => {
      const d = a.querySelector<HTMLElement>('.cp-attr-d')!
      return { ticks: [...a.querySelectorAll('.cp-mark')].filter(shown).length, delta: shown(d) && /^([+\u2212]\d+|avg)$/.test(d.textContent!.trim()), size: parseFloat(getComputedStyle(d).fontSize) >= 14 }
    })
    return { text: n.textContent, left: r.left, right: r.right, list: list.width * list.height, dots: document.querySelectorAll('.cp-dot').length, title: shown(document.querySelector('.cp-nameplate')!), ghosts, rows, art: art.width / panel.width, marks }
  })
  const ps = JSON.stringify(plate)
  expect(plate.text).toBe('Ghost')
  expect(plate.left >= 0 && plate.right <= 390, ps).toBe(true)
  expect(plate.list, ps).toBeLessThanOrEqual(1)
  expect(plate.dots).toBe(5)
  expect(plate.title, ps).toBe(false)
  expect(plate.ghosts, ps).toBe(1)
  expect(plate.rows.length, ps).toBe(3)
  // Plan item 709: the trees are one line of stamps; 'What they do' opens each to its effect (item 397's rows).
  for (const r of plate.rows) expect(!r.shown && r.text.length > 8, ps).toBe(true)
  await page.locator('.cp-trees-more').click()
  const opened = await page.locator('.cp-sheet .skill-row .cp-tree-theme').evaluateAll((els) => els.map((e) => (e as HTMLElement).offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) >= 12))
  expect(opened, ps).toEqual([true, true, true])
  await page.locator('.cp-trees-more').click()
  // Plan item 709 slice 3: the stats are one row of four ring dials (40 px); a tap opens the bars read against the
  // field (item 559's bars with her lead), and a second tap folds them.
  const statRow = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.cp-attr')].map((a) => {
        const r = a.getBoundingClientRect()
        const ring = a.querySelector('.cp-bar')!.getBoundingClientRect()
        return { top: Math.round(r.top), ring: [Math.round(ring.width), Math.round(ring.height)] }
      }),
    )
  const dials = await statRow()
  expect(new Set(dials.map((d) => d.top)).size, JSON.stringify(dials)).toBe(1)
  for (const d of dials) expect(d.ring, JSON.stringify(dials)).toEqual([40, 40])
  await page.locator('.cp-attrs').click()
  const bars = await statRow()
  expect(new Set(bars.map((d) => d.top)).size, JSON.stringify(bars)).toBe(2)
  for (const d of bars) expect(d.ring[0]! > 40 && d.ring[1]! <= 10, JSON.stringify(bars)).toBe(true)
  await page.locator('.cp-attrs').click()
  expect(new Set((await statRow()).map((d) => d.top)).size).toBe(1)
  // Plan item 422: she holds the gun on the stage, so its slab is a plate beside the name and numbers (about 40% of
  // the panel; it spanned the panel, item 397), its height given to her figure.
  expect(plate.art, ps).toBeGreaterThanOrEqual(0.36)
  expect(plate.marks, ps).toEqual(Array(4).fill({ ticks: 0, delta: true, size: true }))
  // Plan item 125: the whole file is one screen at 390x844 and 375x667: every stat, the weapon and the hold bar
  // inside the viewport with no scroll, text 12 px or more; her quote unfolds behind a tap.
  for (const size of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(400)
    const m = await page.evaluate(() => {
      const cp = document.querySelector('.cp')!
      const box = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width }
      }
      const small = [...cp.querySelectorAll<HTMLElement>('*')]
        .filter((e) => e.offsetParent && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
        .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12)
        .map((e) => e.className)
      return { scroll: cp.scrollHeight - cp.clientHeight, small, attrs: box('.cp-attrs'), weapon: box('.cp-weapon'), art: box('.cp-weapon-art'), hold: box('.cp-hold'), n: document.querySelectorAll('.cp-attr').length }
    })
    const s = JSON.stringify({ size, m })
    expect(m.scroll, s).toBeLessThanOrEqual(0)
    expect(m.small, s).toEqual([])
    expect(m.n).toBe(4)
    for (const b of [m.attrs, m.weapon, m.hold]) expect(b.top >= 0 && b.bottom <= size.height && b.left >= 0 && b.right <= size.width, s).toBe(true)
    expect(m.art.bottom - m.art.top, s).toBeGreaterThanOrEqual(44)
    expect(m.hold.w, s).toBeGreaterThan(size.width - 40)
    // Plan item 559: upright, her line starts folded (she speaks it as the stage's subtitle, item 518); a tap opens it.
    await expect(page.locator('.cp-line')).toBeHidden()
  }
  await page.locator('.cp-fold').click()
  await expect(page.locator('.cp-fold')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.cp-line')).toBeVisible()
  await page.locator('.cp-fold').click()
  await expect(page.locator('.cp-line')).toBeHidden()
  const hold = (await page.locator('.cp-hold').boundingBox())!
  expect(hold.y + hold.height).toBeLessThanOrEqual(667)
})

// Plan item 117: on the class pick at D her face is in the frame and not under the stats sheet.
test('the class pick shows her face clear of the stats sheet', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop class pick')
  test.setTimeout(300_000)
  await fresh(page, false)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  type F = { cathodeFront?: { scene: () => { dressed: string | null; faceBox(): Box } | null } }
  await expect.poll(() => page.evaluate(() => (window as unknown as F).cathodeFront?.scene()?.dressed ?? null), { timeout: 200_000 }).toBe('ghost')
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => {
    const r = document.querySelector('.cp-sheet')!.getBoundingClientRect()
    return { face: (window as unknown as F).cathodeFront!.scene()!.faceBox(), sheet: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }
  })
  const { face, sheet } = m
  expect(face.top >= 0 && face.left >= 0 && face.right <= 1440 && face.bottom <= 900, JSON.stringify(m)).toBe(true)
  expect(face.left < sheet.right && face.right > sheet.left && face.top < sheet.bottom && face.bottom > sheet.top, JSON.stringify(m)).toBe(false)
})

// Plan item 129: at D every class frames her face-on in the middle band, at least 110 px tall, meeting neither the
// stats sheet nor the names; a class change has its weapon-rack stinger, heard in an offline render.
test('every class frames her face in the middle band, and each has an audible rack stinger', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop class pick')
  test.setTimeout(400_000)
  type F = { cathodeFront?: { ready: boolean; rack(c: string): Promise<{ peak: number; rms: number; seconds: number }>; scene: () => { faceBox(): Box; propBox(): (Box & { inFace: number }) | null } | null } }
  const db = (d: number) => Math.pow(10, d / 20)
  for (const cls of CLASSES) {
    await fresh(page, false)
    await page.goto(`/nightshift/?front=classpick&shot&t=8&class=${cls}&rs=0.5`)
    await page.waitForFunction(() => (window as unknown as F).cathodeFront?.ready === true, null, { timeout: 150_000 })
    const m = await page.evaluate(() => {
      const b = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      }
      const sc = (window as unknown as F).cathodeFront!.scene()!
      return { face: sc.faceBox(), prop: sc.propBox(), sheet: b('.cp-sheet'), list: b('.cp-left') }
    })
    const s = JSON.stringify({ cls, m })
    const { face } = m
    // Plan item 247: her face 70 px across or more, and nothing she holds (rifle, shotgun, case) crosses it.
    expect(face.right - face.left, s).toBeGreaterThanOrEqual(70)
    expect(m.prop?.inFace ?? 0, s).toBe(0)
    // Owner, 2026-11-08: the pick frames her head to toe under the umbrella, so her face sits higher (90 px from the top).
    expect(face.left >= 470 && face.right <= 960 && face.top >= 90 && face.bottom <= 500, s).toBe(true)
    // Plan item 161: she stands whole between the columns now, so her face is 85 px or more (was 110 at a closer cut).
    expect(face.bottom - face.top, s).toBeGreaterThanOrEqual(85)
    for (const o of [m.sheet, m.list]) expect(face.left < o.right && face.right > o.left && face.top < o.bottom && face.bottom > o.top, s).toBe(false)
    const a = await page.evaluate((c) => (window as unknown as F).cathodeFront!.rack(c), cls)
    expect(a.peak, `${cls} ${JSON.stringify(a)}`).toBeGreaterThan(db(-24))
    expect(a.peak, `${cls} ${JSON.stringify(a)}`).toBeLessThan(db(-1))
    expect(a.seconds, `${cls} ${JSON.stringify(a)}`).toBeLessThan(0.6)
  }
})

// Plan item 136: each class change is a 3 s audition, started at once: a cut to the class's angle with her face
// framed (110 px or more at D in the middle band, 70 at P), the pose, and her line as a subtitle under her that
// stays inside the screen and off the names, the sheet and her words.
test('a class change starts its audition at once, her face framed and her line subtitled', async ({ page, hasTouch }) => {
  test.setTimeout(420_000)
  type F = { cathodeFront?: { scene: () => { dressed: string | null; vignette: { kind: string; u: number; prop: string | null } | null; faceBox(): Box } | null } }
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as F).cathodeFront?.scene()?.dressed ?? null), { timeout: 200_000 }).toBe('ghost')
  const W = hasTouch ? 390 : 1440
  const H = hasTouch ? 844 : 900
  // Plan item 138: every name in the row is whole on screen (the phone row once cut WIREWITCH and hid FIXER).
  const tabs = await page.locator(hasTouch ? '.cp-dot' : '.cp-opt').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right] as [number, number] }))
  for (const [l, r] of tabs) expect(l >= 0 && r <= W, JSON.stringify(tabs)).toBe(true)
  for (const cls of [...CLASSES.slice(1), 'ghost']) {
    await pick(page, cls, hasTouch)
    // Started within the click's own task: no frame needs to pass.
    const v = await page.evaluate(() => (window as unknown as F).cathodeFront!.scene()!.vignette)
    expect(v?.kind, cls).toBe(cls)
    // Her line comes up with the cut. Read it here: under swiftshader the pick's lit gun reel (item 313) can hold the
    // page for seconds, past the line's 3.2 s, before the wait below returns.
    // Plan item 622: on an upright phone as a subtitle; at D the column's open quote is the one spoken (the subtitle
    // between the columns said it twice, over her skirt), so no subtitle shows there.
    const said = await page.evaluate(() => ({ sub: document.querySelector('.cp-sub')!.classList.contains('is-on'), line: document.querySelector('.cp-line')!.classList.contains('is-said'), words: document.querySelectorAll('.cp-line .cp-sub-w').length }))
    expect(said.sub, cls).toBe(!!hasTouch)
    if (!hasTouch) expect(said.line && said.words > 3, cls).toBe(true)
    await page.waitForTimeout(1200)
    const m = await page.evaluate(() => {
      const b = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      }
      const sub = document.querySelector('.cp-sub')!
      return {
        face: (window as unknown as F).cathodeFront!.scene()!.faceBox(),
        sub: b('.cp-sub'), on: sub.classList.contains('is-on'), text: sub.textContent ?? '', size: parseFloat(getComputedStyle(sub).fontSize),
        sheet: b('.cp-sheet'), list: b('.cp-list'), words: b('.cp-words'), head: b('.cp-head'),
      }
    })
    const s = JSON.stringify({ cls, m })
    const meets = (a: Box, o: Box) => a.left < o.right && a.right > o.left && a.top < o.bottom && a.bottom > o.top
    const { face } = m
    // Owner, 2026-11-08: head to toe on the pick, so an upright phone's face is 45 px or more (was 70 knees-up).
    expect(face.bottom - face.top, s).toBeGreaterThanOrEqual(hasTouch ? 45 : 85)
    expect(face.left >= 0 && face.top >= 0 && face.right <= W && face.bottom <= H, s).toBe(true)
    if (!hasTouch) {
      expect(face.left >= 470 && face.right <= 960 && face.top >= 90 && face.bottom <= 500, s).toBe(true)
      for (const o of [m.sheet, m.list]) expect(meets(face, o), s).toBe(false)
    }
    if (!hasTouch) continue
    expect(m.text.length, s).toBeGreaterThan(10)
    expect(m.size, s).toBeGreaterThanOrEqual(13)
    expect(m.sub.left >= 0 && m.sub.top >= 0 && m.sub.right <= W && m.sub.bottom <= H, s).toBe(true)
    for (const o of [m.sheet, m.list, m.words, m.head]) expect(meets(m.sub, o), s).toBe(false)
    expect(meets(m.sub, face), s).toBe(false)
  }
  // Gone after the audition.
  await expect(page.locator('.cp-sub')).not.toHaveClass(/is-on/, { timeout: 6000 })
  // The Ghost unslings her rifle, the Butcher racks the shotgun off her hip: the gun is in her hand. Held
  // mid-audition: under SwiftShader a frame can take longer than the gun's 2.4 s in hand. Plan item 449: the
  // Ghost's held stance (0.5, the pick's first frame) has the rifle slung again, so she is held at 0.4.
  type C = { cathodeFront: { scene: () => { wardrobe(c: string, i: boolean): void; cath: { play(k: string, u?: number): void } } } }
  for (const [cls, gun, u] of [['butcher', 'shotgun', 0.5], ['ghost', 'rifle', 0.4]] as const) {
    await page.evaluate(([c, at]) => {
      const sc = (window as unknown as C).cathodeFront.scene()
      sc.wardrobe(c, true)
      sc.cath.play(c, at)
    }, [cls, u] as const)
    await expect.poll(() => page.evaluate(() => (window as unknown as F).cathodeFront!.scene()!.vignette?.prop ?? null), { timeout: 15_000 }).toBe(gun)
    // Plan item 449: the class's key swings to the gun for its beat (within about a metre of it, from 1.5 m or more).
    type L = { cathodeFront: { scene: () => { gunLight: { swing: number; dist: number | null } } } }
    await expect.poll(() => page.evaluate(() => (window as unknown as L).cathodeFront.scene().gunLight.swing), { timeout: 15_000 }).toBeGreaterThan(0.9)
    const gl = await page.evaluate(() => (window as unknown as L).cathodeFront.scene().gunLight)
    expect(gl.dist ?? 9, `${cls} ${JSON.stringify(gl)}`).toBeLessThan(1)
  }
})

// Plan item 161: at D she stands whole, key-lit, between the class list and the sheet: her figure 300 px or taller,
// her body clear of the list's column and the sheet, the umbrella clear of the names; keys 1-5 change the stage's
// class within 650 ms.
test('at D she stands whole between the list and the sheet, and keys 1-5 change her class', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop class pick')
  test.setTimeout(300_000)
  type F = { cathodeFront?: { scene: () => { dressed: string | null; figureBox(body?: boolean): Box } | null } }
  await fresh(page, false)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as F).cathodeFront?.scene()?.dressed ?? null), { timeout: 200_000 }).toBe('ghost')
  const canvas = page.locator('canvas[data-class]').first()
  type W = { __kd?: number; __ch?: number }
  for (const [i, cls] of CLASSES.entries()) {
    // The page's own clock, from the key going down to the canvas taking the class (a wall-clock check here also
    // counted the key press's and the polls' round trips: 859-921 ms on the release machine, 1.4-1.8 s on a loaded
    // CI shard, with the class already changed). The first key re-picks the class she wears, so nothing changes.
    await page.evaluate(() => {
      const w = window as unknown as W
      w.__kd = 0
      w.__ch = 0
      addEventListener('keydown', () => (w.__kd = performance.now()), { once: true, capture: true })
      const c = document.querySelector('canvas[data-class]')!
      new MutationObserver((_, o) => {
        w.__ch = performance.now()
        o.disconnect()
      }).observe(c, { attributes: true, attributeFilter: ['data-class'] })
    })
    await page.keyboard.press(String(i + 1))
    await expect(canvas).toHaveAttribute('data-class', cls, { timeout: 650 })
    const lag = await page.evaluate(() => {
      const w = window as unknown as W
      return w.__ch ? w.__ch - (w.__kd ?? 0) : 0
    })
    expect(lag, cls).toBeLessThan(650)
    // After the audition's cut eases home (3 s), the settled framing.
    await page.waitForTimeout(3600)
    const m = await page.evaluate(() => {
      const b = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      }
      const names = [...document.querySelectorAll('.cp-opt-name')].map((e) => e.getBoundingClientRect().right)
      const scene = (window as unknown as F).cathodeFront!.scene()!
      return { fig: scene.figureBox(), body: scene.figureBox(true), sheet: b('.cp-sheet'), list: b('.cp-left'), names: Math.max(...names) }
    })
    const s = JSON.stringify({ cls, m })
    expect(m.fig.bottom - m.fig.top, s).toBeGreaterThanOrEqual(300)
    expect(m.fig.left, s).toBeGreaterThan(m.names)
    expect(m.fig.right, s).toBeLessThan(m.sheet.left)
    expect(m.body.left, s).toBeGreaterThan(m.list.right)
  }
})

// Plan item 199: the class weapon is a prop on the armoury's case table (`[data-armoury-prop]`), naming the class and
// changing with it: 200 px or wider at D, 140 at P, turning slowly (held still under reduced motion).
test('the class weapon lies on the armoury case table and changes with the class', async ({ page, hasTouch }) => {
  test.setTimeout(180_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  const prop = page.locator('[data-armoury-prop]')
  for (const cls of CLASSES) {
    await pick(page, cls, hasTouch)
    await expect(prop).toHaveAttribute('data-armoury-prop', cls)
    const w = (await prop.locator('.cp-prop').boundingBox())!.width
    expect(w, cls).toBeGreaterThanOrEqual(hasTouch ? 140 : 200)
  }
  if ((await page.locator('.cp-weapon-art.is-lit').count()) > 0) {
    // Plan item 313: the lit gun turns by stepping its reel's frames.
    const gun = page.locator('.cp-gun')
    const first = await gun.getAttribute('src')
    await expect.poll(() => gun.getAttribute('src'), { timeout: 60_000 }).not.toBe(first)
    return
  }
  expect(await page.locator('.cp-prop-turn').evaluate((e) => getComputedStyle(e).animationName)).toBe('cp-prop-turn')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.cp-prop-turn').evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
})

// Plan item 313: the class's own gun mesh, lit on the case table: a bright specular highlight off the key, and its
// rim in the class's colour (the Gunslinger's gold).
test('the class weapon is lit in 3D with a specular highlight', async ({ page, hasTouch }) => {
  test.setTimeout(240_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=gunslinger&rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const gun = page.locator('.cp-weapon-art.is-lit .cp-gun')
  await expect(gun).toHaveCount(1)
  // The rack's guns are thumbnails of the same meshes (desktop; the phone hides the rack).
  await expect(page.locator('.cp-opt-gear.is-lit .cp-opt-gun')).toHaveCount(5)
  if (!hasTouch) {
    // Plan item 434: each rack gun reads 3:1 or more on its row (its opaque pixels' median, from the screen, against
    // the row just left of the thumbnail); they were grey shapes on black at 1.1-1.7:1.
    await page.waitForTimeout(400)
    const shot = (await page.screenshot()).toString('base64')
    const rack = await page.evaluate(async (s) => {
      const i = new Image()
      i.src = `data:image/png;base64,${s}`
      await i.decode()
      const c = document.createElement('canvas')
      c.width = i.width
      c.height = i.height
      const x = c.getContext('2d')!
      x.drawImage(i, 0, 0)
      const D = x.getImageData(0, 0, c.width, c.height).data
      const k = c.width / innerWidth
      const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
      const L = (X: number, Y: number) => {
        const j = (Math.round(Y * k) * c.width + Math.round(X * k)) * 4
        return 0.2126 * lin(D[j]!) + 0.7152 * lin(D[j + 1]!) + 0.0722 * lin(D[j + 2]!)
      }
      const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)]!
      return [...document.querySelectorAll<HTMLImageElement>('.cp-opt-gun')].map((img) => {
        const box = img.getBoundingClientRect()
        const t = document.createElement('canvas')
        t.width = img.naturalWidth
        t.height = img.naturalHeight
        const tx = t.getContext('2d')!
        tx.drawImage(img, 0, 0)
        const a = tx.getImageData(0, 0, t.width, t.height).data
        const gun: number[] = []
        for (let y = 0; y < t.height; y += 2) {
          for (let X = 0; X < t.width; X += 2) if (a[(y * t.width + X) * 4 + 3]! > 230) gun.push(L(box.left + (X / t.width) * box.width, box.top + (y / t.height) * box.height))
        }
        const bg = med([...Array(10).keys()].map((n) => L(box.left - 6, box.top + (box.height * (n + 0.5)) / 10)))
        const g = med(gun)
        return { cls: img.closest<HTMLElement>('.cp-opt')!.dataset.cls, cr: (Math.max(g, bg) + 0.05) / (Math.min(g, bg) + 0.05) }
      })
    }, shot)
    for (const r of rack) expect(r.cr, JSON.stringify(rack)).toBeGreaterThanOrEqual(3)
  }
  const m = await gun.evaluate(async (img: HTMLImageElement) => {
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const x = c.getContext('2d')!
    x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    let solid = 0
    let bright = 0
    let top = c.height
    let bottom = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! < 200) continue
      solid++
      const y = Math.floor(i / 4 / c.width)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      if (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]! > 200) bright++
    }
    const box = img.getBoundingClientRect()
    return { w: c.width, h: c.height, solid, bright, top, bottom, view: [Math.round(box.width), Math.round(box.height)] }
  })
  const s = JSON.stringify(m)
  expect(m.w, s).toBeGreaterThanOrEqual(600)
  expect(m.solid / (m.w * m.h), s).toBeGreaterThan(0.05)
  expect(m.bright, s).toBeGreaterThan(20)
  // The revolver stands whole in its frame (fitted by height as well as length), in a view 360 x 150 px or more at D
  // and 156 x 70 or more on a phone.
  expect(m.top, s).toBeGreaterThan(4)
  expect(m.bottom, s).toBeLessThan(m.h - 5)
  expect(m.view[0], s).toBeGreaterThanOrEqual(hasTouch ? 156 : 360)
  expect(m.view[1], s).toBeGreaterThanOrEqual(hasTouch ? 70 : 150)
})

// Plan item 233: at D the names are a lit rack: each row carries its weapon in neon outline (48 px or more) over a
// labelled range meter (plan item 334), the picked row lifts, and no empty band over 120 px stands in the left column.
test('at D the classes are a lit rack with no empty band under them; keys move the pick', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'desktop layout; the phone keeps its row of names')
  test.setTimeout(300_000)
  await fresh(page, false)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const rack = await page.evaluate(() => {
    const rows = [...document.querySelectorAll<HTMLElement>('.cp-opt')]
    return rows.map((r) => ({
      gear: r.querySelector('.cp-opt-gear')!.getBoundingClientRect().width,
      segs: r.querySelectorAll('.cp-opt-meter:not(.is-noise) .cp-seg').length,
      label: r.querySelector('.cp-meter-k')?.textContent,
      word: r.querySelector('.cp-meter-v')?.textContent,
      noise: r.querySelector('.cp-opt-meter.is-noise .cp-meter-v')?.textContent,
      noiseSegs: r.querySelectorAll('.cp-opt-meter.is-noise .cp-seg').length,
      role: r.querySelector('.cp-opt-role')?.textContent,
      roleFont: parseFloat(getComputedStyle(r.querySelector('.cp-opt-role')!).fontSize),
      text: (r.querySelector('.cp-opt-body') as HTMLElement).innerText,
      bottom: r.getBoundingClientRect().bottom,
    }))
  })
  expect(rack).toHaveLength(5)
  for (const r of rack) {
    expect(r.gear).toBeGreaterThanOrEqual(48)
    // Plan item 334: a labelled three-step range meter, not four bare pips.
    expect(r.segs).toBe(3)
    expect(r.label).toBe('Range')
    expect(['Close', 'Mid', 'Long']).toContain(r.word)
    // Plan item 400: a second, per-class Noise meter, and her signature tree on its own line at 14 px+.
    expect(r.noiseSegs).toBe(3)
    expect(['Quiet', 'Mixed', 'Loud']).toContain(r.noise)
    expect(r.role?.length).toBeGreaterThan(2)
    expect(r.roleFont).toBeGreaterThanOrEqual(14)
  }
  expect(new Set(rack.map((r) => r.text)).size).toBe(5)
  // The gap from the last row to the first of her words, in the left column (x 0-560).
  const wordsTop = await page.evaluate(() => {
    const tops = [...document.querySelectorAll<HTMLElement>('.cp-words > *')]
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.height > 0 && b.left < 560)
      .map((b) => b.top)
    return Math.min(...tops)
  })
  expect(wordsTop - rack[4]!.bottom).toBeLessThanOrEqual(120)
  const lift = (cls: string) => page.evaluate((c) => new DOMMatrix(getComputedStyle(document.querySelector(`.cp-opt[data-cls=${c}]`)!).transform).m41, cls)
  await expect.poll(() => lift('ghost')).toBeGreaterThan(4)
  await page.keyboard.press('3')
  await expect(page.locator('.cp-opt[data-cls=gunslinger]')).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => lift('gunslinger')).toBeGreaterThan(4)
  await expect.poll(() => lift('ghost')).toBe(0)
  await page.locator('.cp-opt[data-cls=gunslinger]').focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('.cp-opt[data-cls=wirewitch]')).toHaveAttribute('aria-checked', 'true')
})

// Plan item 245: on an upright phone a swipe across her changes class and pose, the class title follows (40 px or
// more and whole for every class, Gunslinger and Wirewitch shrunk to fit), and arrows and keys 1-5 still move it.
test('on a phone a swipe changes the class, its title large and whole; keys still work', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the upright phone')
  test.setTimeout(300_000)
  await fresh(page, true)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as Front).cathodeFront?.scene()?.dressed ?? null), { timeout: 200_000 }).toBe('ghost')
  const canvas = page.locator('canvas[data-class]').first()
  const swipe = (dx: number) =>
    page.evaluate((dx) => {
      const cp = document.querySelector('.cp')!
      const at = (type: string, x: number) => cp.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 7, clientX: x, clientY: 300, bubbles: true }))
      at('pointerdown', 200)
      at('pointerup', 200 + dx)
    }, dx)
  for (const cls of CLASSES.slice(1)) {
    await swipe(-120)
    await expect(page.locator('.cp')).toHaveAttribute('data-class', cls)
    await expect(canvas).toHaveAttribute('data-class', cls, { timeout: 5000 })
    await expect(page.locator(`.cp-dot[data-cls=${cls}]`)).toHaveClass(/is-on/)
    await page.waitForTimeout(400) // the title's 250 ms slide in
    // Plan item 397: the open tab names the class (the big title went).
    const m = await page.locator('.cp-dot.is-on .cp-dot-name').evaluate((n) => {
      const r = n.getBoundingClientRect()
      return { text: n.textContent, left: r.left, right: r.right, sw: n.scrollWidth, cw: n.clientWidth }
    })
    const s = JSON.stringify({ cls, m })
    expect(m.text?.toLowerCase(), s).toBe(cls)
    expect(m.left >= 0 && m.right <= 390 && m.sw <= m.cw + 1, s).toBe(true)
  }
  // A swipe the other way steps back; a short or upright drag does nothing.
  await swipe(120)
  await expect(page.locator('.cp')).toHaveAttribute('data-class', 'wirewitch')
  await swipe(30)
  await expect(page.locator('.cp')).toHaveAttribute('data-class', 'wirewitch')
  await page.keyboard.press('2')
  await expect(page.locator('.cp')).toHaveAttribute('data-class', 'butcher')
  await page.locator('.cp-opt[data-cls=butcher]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.cp')).toHaveAttribute('data-class', 'gunslinger')
  await expect(page.locator('.cp-dot.is-on .cp-dot-name')).toHaveText('Gunslinger')
})

// Plan item 375: on an upright phone the five classes are named tabs (each its gun and its name at 14 px or more,
// all in view), the class title no taller than 80 px, her line shown without a tap, and the hold bar's gutters even.
test('the phone class pick names every class on a tab', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the upright phone')
  test.setTimeout(300_000)
  await fresh(page, true)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp-dot').first()).toBeVisible({ timeout: 120_000 })
  for (const size of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(600)
    const m = await page.evaluate(() => {
      const box = (e: Element) => e.getBoundingClientRect()
      const tabs = [...document.querySelectorAll('.cp-dot')].map((d) => {
        const n = d.querySelector('.cp-dot-name')!
        const r = box(d)
        return { name: n.textContent, size: parseFloat(getComputedStyle(n).fontSize), whole: n.scrollWidth <= (n as HTMLElement).offsetWidth + 1 && box(n).right <= r.right + 1 && box(n).left >= r.left - 1, inView: r.left >= 0 && r.right <= innerWidth, gun: !!d.querySelector('.cp-dot-gun svg') }
      })
      const hold = box(document.querySelector('.cp-hold')!)
      return { tabs, title: box(document.querySelector('.cp-nameplate')!).height, line: (document.querySelector('.cp-line') as HTMLElement).offsetHeight, fold: (document.querySelector('.cp-fold') as HTMLElement).offsetHeight, gutters: [hold.left, innerWidth - hold.right] }
    })
    const s = JSON.stringify({ size, m })
    expect(m.tabs.map((t) => t.name), s).toEqual(['Ghost', 'Butcher', 'Gunslinger', 'Wirewitch', 'Fixer'])
    for (const t of m.tabs) {
      expect(t.size, s).toBeGreaterThanOrEqual(14)
      expect(t.whole && t.inView && t.gun, s).toBe(true)
    }
    expect(m.title, s).toBeLessThanOrEqual(80)
    // Plan item 559: her line starts folded upright (she speaks it as the subtitle); its toggle is there to open it.
    expect(m.line, s).toBe(0)
    expect(m.fold, s).toBeGreaterThan(0)
    expect(Math.abs(m.gutters[0]! - m.gutters[1]!), s).toBeLessThanOrEqual(2)
  }
})

// Plan item 423: five weapons told apart at a glance: each class shows its own gun (the Wirewitch's smart SMG and
// the Fixer's launcher, not the sidearm both start the sheet with), their drawn silhouettes overlap little, the
// desktop rack's guns are 110 px wide or more, and each name is the sim's.
test('the five classes show five different guns, by name and silhouette', async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const sel = hasTouch ? '.cp-dot-gun .wa-body' : '.cp-opt-gear'
  if (!hasTouch) {
    const widths = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))
    expect(widths).toHaveLength(5)
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(110)
  }
  // Pairwise IoU of the drawn profiles (the phone tabs' silhouettes; the same art stands in on the desktop rack).
  const iou = await page.evaluate(async () => {
    const ds = [...document.querySelectorAll<HTMLElement>('.cp-dot-gun')].map((g) => g.querySelector('.wa-body')!.getAttribute('d')!)
    const masks = ds.map((d) => {
      const c = document.createElement('canvas')
      c.width = 240
      c.height = 80
      const x = c.getContext('2d')!
      x.fill(new Path2D(d))
      const px = x.getImageData(0, 0, 240, 80).data
      const m = new Uint8Array(240 * 80)
      for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3]! > 127 ? 1 : 0
      return m
    })
    let worst = 0
    for (let a = 0; a < masks.length; a++)
      for (let b = a + 1; b < masks.length; b++) {
        let i = 0
        let u = 0
        for (let k = 0; k < masks[a]!.length; k++) {
          i += masks[a]![k]! & masks[b]![k]!
          u += masks[a]![k]! | masks[b]![k]!
        }
        worst = Math.max(worst, i / u)
      }
    return { n: masks.length, worst }
  })
  expect(iou.n).toBe(5)
  expect(iou.worst).toBeLessThan(0.6)
  const names: Record<string, string> = { ghost: 'Widowmaker', butcher: 'Street Sweeper', gunslinger: 'Old Testament', wirewitch: 'Candor Seeker', fixer: 'Bargain Bin' }
  for (const cls of CLASSES) {
    await pick(page, cls, hasTouch)
    await expect(page.locator('.cp-weapon-name')).toHaveText(new RegExp(names[cls]!, 'i'))
  }
})

// Plan item 504: at D the spec column is a paper case file: its class on the folder (changing on keys 1-5), its
// type 4.5:1 on the cream and the weapon's name 7:1, her line a slip of the same paper, a class switch turning the
// page in 250 ms or less, and Walk in the file's red stamp.
test('at D the stat sheet is a paper case file that turns its page on a class change', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop file (the phone has its own paper file, armoury spec)')
  test.setTimeout(300_000)
  await fresh(page, false)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(400)
    for (const [i, cls] of CLASSES.entries()) {
      await page.keyboard.press(String(i + 1))
      await expect(page.locator(`.cp-sheet[data-casefile][data-class=${cls}]`)).toHaveCount(1)
      const turn = await page.evaluate(() =>
        document.querySelector('.cp-sheet')!.firstElementChild!.getAnimations().map((a) => ({ name: (a as CSSAnimation).animationName, ms: Number(a.effect!.getComputedTiming().duration) })),
      )
      if (i > 0) expect(turn.find((a) => a.name === 'cp-file-turn')?.ms, JSON.stringify(turn)).toBeLessThanOrEqual(250)
    }
    await page.waitForTimeout(600)
    const m = await page.evaluate(() => {
      const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
      const lum = (c: string) => {
        const [r, g, b] = c.match(/[\d.]+/g)!.map(Number)
        return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!)
      }
      const ratio = (a: string, b: string) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
        return (x! + 0.05) / (y! + 0.05)
      }
      const probe = document.createElement('i')
      document.querySelector('.cp-sheet')!.append(probe)
      probe.style.color = 'var(--card-paper)'
      const paper = getComputedStyle(probe).color
      probe.remove()
      const sheet = document.querySelector('.cp-sheet')!
      const texts = [...sheet.querySelectorAll<HTMLElement>('*')]
        .filter((e) => e.offsetParent && !e.closest('.cp-hold, .cp-weapon-art') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
        .map((e) => ({ cls: e.className, r: ratio(getComputedStyle(e).color, paper) }))
      const lineEl = document.querySelector<HTMLElement>('.cp-line')!
      const lineBg = getComputedStyle(lineEl, '::before').backgroundColor
      return {
        worst: texts.sort((a, b) => a.r - b.r)[0],
        head: ratio(getComputedStyle(document.querySelector('.cp-weapon-name')!).color, paper),
        line: ratio(getComputedStyle(lineEl).color, lineBg === 'rgba(0, 0, 0, 0)' ? paper : lineBg),
        stamp: getComputedStyle(document.querySelector('.cp-hold')!).boxShadow.includes('inset'),
        inView: sheet.getBoundingClientRect().bottom <= innerHeight,
      }
    })
    const s = JSON.stringify({ size, m })
    expect(m.worst!.r, s).toBeGreaterThanOrEqual(4.5)
    expect(m.head, s).toBeGreaterThanOrEqual(7)
    expect(m.line, s).toBeGreaterThanOrEqual(4.5)
    expect(m.stamp && m.inView, s).toBe(true)
  }
})

// Plan item 575: the classes as a dossier lineup: each row (D) or name tab (P) shows her booking photo, 48 px or more.
test('each class shows her booking photo, 48 px or more', async ({ page, hasTouch }) => {
  test.setTimeout(150_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  const mugs = page.locator(hasTouch ? '.cp-dot .cp-dot-mug' : '.cp-opt > .cp-opt-mug')
  await expect(mugs).toHaveCount(5, { timeout: 120_000 })
  // (the 2D bust, or item 588's 3D still once the street can shoot it)
  const sizes = await mugs.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), !!e.querySelector('svg, img.cp-mug-photo')] }))
  for (const [w, h, art] of sizes) {
    expect(Math.min(w as number, h as number), JSON.stringify(sizes)).toBeGreaterThanOrEqual(48)
    expect(art).toBe(true)
  }
  // Plan item 695: on a phone tab the file number is a corner tab, not a placard across her chin (the photo's lower half).
  if (hasTouch) {
    const plates = await mugs.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); const p = e.querySelector('.cp-mug-plate')?.getBoundingClientRect(); return p ? (p.bottom - r.top) / r.height : 0 }))
    for (const f of plates) expect(f, JSON.stringify(plates)).toBeLessThanOrEqual(0.4)
  }
})

// Plan item 588: once the street is up, the five booking photos are stills of the 3D figure in each class's coat, kit,
// pose and face (not the 2D cartoon), each set apart from the others by 15% or more of its pixels.
test('the booking photos are 3D stills of her, five different looks', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one renderer, one set of photos: the desktop rows are enough')
  test.setTimeout(200_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  const photos = page.locator('.cp-opt > .cp-opt-mug[data-photo="3d"] img.cp-mug-photo')
  await expect(photos).toHaveCount(5, { timeout: 150_000 })
  const diff = await photos.evaluateAll(async (imgs) => {
    const px: Uint8ClampedArray[] = []
    for (const img of imgs as HTMLImageElement[]) {
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      px.push(x.getImageData(0, 0, c.width, c.height).data)
    }
    const out: number[] = []
    for (let a = 0; a < px.length; a++)
      for (let b = a + 1; b < px.length; b++) {
        const A = px[a]!
        const B = px[b]!
        let n = 0
        for (let i = 0; i < A.length; i += 4) {
          if (Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!) + Math.abs(A[i + 3]! - B[i + 3]!) > 60) n++
        }
        out.push(n / (A.length / 4))
      }
    return out
  })
  expect(diff).toHaveLength(10)
  for (const d of diff) expect(d, JSON.stringify(diff)).toBeGreaterThanOrEqual(0.15)
})

// Plan item 709: at 390x844 the role's name, its gun and the hold bar are in view without scrolling; the role tabs are
// 44 px+ with 8 px+ between; the roster is in colour, and the red rule under the picked tab stands 3:1+ against the
// others' rule.
test('upright phone: the picked role, its gun and the hold in view; tabs 44 px apart by 8; the picked rule 3:1', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the upright phone pick')
  test.setTimeout(300_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=gunslinger&rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  const m = await page.evaluate(() => {
    const r = (e: Element | null) => { const b = e!.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom } }
    const tabs = [...document.querySelectorAll('.cp-dot')].map(r)
    return {
      tabs,
      name: r(document.querySelector('.cp-dot.is-on .cp-dot-name')),
      gun: r(document.querySelector('.cp-weapon-art')),
      hold: r(document.querySelector('.cp-hold')),
      scroll: document.scrollingElement!.scrollTop,
      mugFilter: getComputedStyle(document.querySelector('.cp-dot:not(.is-on) .cp-dot-mug')!).filter,
    }
  })
  expect(m.scroll).toBe(0)
  for (const b of [m.name, m.gun, m.hold]) {
    expect(b.top).toBeGreaterThanOrEqual(0)
    expect(b.bottom).toBeLessThanOrEqual(844)
  }
  expect(m.tabs).toHaveLength(5)
  for (const t of m.tabs) {
    expect(t.right - t.left, 'tab width').toBeGreaterThanOrEqual(44)
    expect(t.bottom - t.top, 'tab height').toBeGreaterThanOrEqual(44)
  }
  for (let i = 1; i < m.tabs.length; i++) expect(m.tabs[i]!.left - m.tabs[i - 1]!.right, 'gap between tabs').toBeGreaterThanOrEqual(8)
  expect(m.mugFilter, 'the roster in colour').not.toContain('grayscale')
  // The rule under each tab, read from pixels: its bottom 2 px row.
  const lum = async (b: Box) => {
    const png = (await page.screenshot({ clip: { x: b.left + 4, y: b.bottom - 3, width: b.right - b.left - 8, height: 2 } })).toString('base64')
    return page.evaluate(async (png) => {
      const img = new Image()
      img.src = `data:image/png;base64,${png}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      let t = 0
      for (let i = 0; i < d.length; i += 4) t += 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!)
      return t / (d.length / 4)
    }, png)
  }
  const picked = await lum(m.tabs[2]!)
  const others = await Promise.all([0, 1, 3, 4].map((i) => lum(m.tabs[i]!)))
  for (const o of others) expect((Math.max(picked, o) + 0.05) / (Math.min(picked, o) + 0.05), 'picked rule against another').toBeGreaterThanOrEqual(3)
  // The trees are one line of stamps until 'What they do' opens them to what each does.
  const tops = await page.locator('.cp-tree').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  expect(new Set(tops).size, 'the trees on one line').toBe(1)
  await expect(page.locator('.cp-tree-theme').first()).toBeHidden()
  const more = page.locator('.cp-trees-more')
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await more.click()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.cp-tree-theme').first()).toBeVisible()
})
