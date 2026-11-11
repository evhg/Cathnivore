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
  for (const cls of CLASSES) {
    await pick(page, cls, hasTouch)
    await expect.poll(dressed, { timeout: 30_000 }).toBe(cls)
    faces[cls] = await page.locator('canvas[data-expression]').first().getAttribute('data-expression')
    // Each class's own kit over the coat (the rifle sling, the apron, the holster, the wire rig, the tie).
    seen.add(`${await dressed()}/${await page.evaluate(() => (window as unknown as Front).cathodeFront!.scene()!.kit)}`)
  }
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
  // Plan item 245: no row of names shows; the class is named in the display face at 40 px or more, whole on the
  // screen, with a page dot per class (the names' row stays in the DOM for keyboards and screen readers).
  const plate = await page.evaluate(() => {
    const n = document.querySelector<HTMLElement>('.cp-nameplate')!
    const r = n.getBoundingClientRect()
    const list = document.querySelector('.cp-list')!.getBoundingClientRect()
    return { text: n.textContent, size: parseFloat(getComputedStyle(n).fontSize), left: r.left, right: r.right, sw: n.scrollWidth, cw: n.clientWidth, list: list.width * list.height, dots: document.querySelectorAll('.cp-dot').length }
  })
  expect(plate.text).toBe('Ghost')
  expect(plate.size, JSON.stringify(plate)).toBeGreaterThanOrEqual(40)
  expect(plate.left >= 0 && plate.right <= 390 && plate.sw <= plate.cw + 1, JSON.stringify(plate)).toBe(true)
  expect(plate.list, JSON.stringify(plate)).toBeLessThanOrEqual(1)
  expect(plate.dots).toBe(5)
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
    await expect(page.locator('.cp-line')).toBeHidden()
  }
  await page.locator('.cp-fold').click()
  await expect(page.locator('.cp-fold')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.cp-line')).toBeVisible()
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
    const subOn = await page.evaluate(() => document.querySelector('.cp-sub')!.classList.contains('is-on'))
    expect(subOn, cls).toBe(true)
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
    expect(m.text.length, s).toBeGreaterThan(10)
    expect(m.size, s).toBeGreaterThanOrEqual(13)
    expect(m.sub.left >= 0 && m.sub.top >= 0 && m.sub.right <= W && m.sub.bottom <= H, s).toBe(true)
    for (const o of [m.sheet, m.list, m.words, m.head]) expect(meets(m.sub, o), s).toBe(false)
    expect(meets(m.sub, face), s).toBe(false)
  }
  // Gone after the audition.
  await expect(page.locator('.cp-sub')).not.toHaveClass(/is-on/, { timeout: 6000 })
  // The Ghost stands her rifle at her eye, the Butcher racks the shotgun off her hip: the gun is in her hand. Held
  // mid-audition (as the pick's first frame holds it): under SwiftShader a frame can take longer than the gun's
  // 2.4 s in hand.
  for (const [cls, gun] of [['butcher', 'shotgun'], ['ghost', 'rifle']] as const) {
    await page.evaluate((c) => (window as unknown as { cathodeFront: { scene: () => { wardrobe(c: string, i: boolean): void } } }).cathodeFront.scene().wardrobe(c, true), cls)
    await expect.poll(() => page.evaluate(() => (window as unknown as F).cathodeFront!.scene()!.vignette?.prop ?? null), { timeout: 15_000 }).toBe(gun)
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
  for (const [i, cls] of CLASSES.entries()) {
    const t0 = Date.now()
    await page.keyboard.press(String(i + 1))
    await expect(canvas).toHaveAttribute('data-class', cls, { timeout: 650 })
    expect(Date.now() - t0).toBeLessThan(650 + 200)
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
// four-pip stat strip, the picked row lifts, and no empty band over 120 px stands in the left column.
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
      pips: r.querySelectorAll('.cp-pip').length,
      bottom: r.getBoundingClientRect().bottom,
    }))
  })
  expect(rack).toHaveLength(5)
  for (const r of rack) {
    expect(r.gear).toBeGreaterThanOrEqual(48)
    expect(r.pips).toBe(4)
  }
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
    const m = await page.locator('.cp-nameplate').evaluate((n) => {
      const r = n.getBoundingClientRect()
      return { text: n.textContent, size: parseFloat(getComputedStyle(n).fontSize), left: r.left, right: r.right, sw: n.scrollWidth, cw: n.clientWidth }
    })
    const s = JSON.stringify({ cls, m })
    expect(m.text?.toLowerCase(), s).toBe(cls)
    expect(m.size, s).toBeGreaterThanOrEqual(40)
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
  await expect(page.locator('.cp-nameplate')).toHaveText('Gunslinger')
})
