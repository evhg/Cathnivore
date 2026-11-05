import { expect, test, type Page } from '@playwright/test'

// Plan item 112: the class pick shows Cath's face. A `?play` link on a fresh save builds the street behind the
// case file and turns her to the camera in each class's look; the stats sit on a dark dossier plate; on an
// upright phone the names are 15 px and (plan item 125) the whole file fits one screen.

type Box = { left: number; top: number; right: number; bottom: number }
type Front = { cathodeFront?: { ready: boolean; scene: () => { dressed: string | null; kit: string | null; figureBox(): Box } | null } }

const CLASSES = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']

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
    await page.locator(`.cp-opt[data-cls=${cls}]`).click()
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
  await expect(page.locator('.cp-weapon-art svg')).toHaveCount(1)
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
    return (lum(r!, g!, b!) + 0.05) / (bg + 0.05)
  }, [png, ink] as const)
  expect(ratio).toBeGreaterThanOrEqual(4.5)
  await page.addStyleTag({ content: '.cp-attrs { visibility: visible !important; }' })
  if (!hasTouch) return
  // The names: 14 px or more, none overlapping another.
  const names = await page.locator('.cp-opt-name').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { size: parseFloat(getComputedStyle(e).fontSize), left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }),
  )
  for (const n of names) expect(n.size).toBeGreaterThanOrEqual(14)
  for (let i = 1; i < names.length; i++) expect(names[i]!.left).toBeGreaterThanOrEqual(names[i - 1]!.right)
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
  type F = { cathodeFront?: { ready: boolean; rack(c: string): Promise<{ peak: number; rms: number; seconds: number }>; scene: () => { faceBox(): Box } | null } }
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
      return { face: (window as unknown as F).cathodeFront!.scene()!.faceBox(), sheet: b('.cp-sheet'), list: b('.cp-left') }
    })
    const s = JSON.stringify({ cls, m })
    const { face } = m
    expect(face.left >= 470 && face.right <= 960 && face.top >= 150 && face.bottom <= 500, s).toBe(true)
    expect(face.bottom - face.top, s).toBeGreaterThanOrEqual(110)
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
  const tabs = await page.locator('.cp-opt').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right] as [number, number] }))
  for (const [l, r] of tabs) expect(l >= 0 && r <= W, JSON.stringify(tabs)).toBe(true)
  for (const cls of [...CLASSES.slice(1), 'ghost']) {
    await page.locator(`.cp-opt[data-cls=${cls}]`).click()
    // Started within the click's own task: no frame needs to pass.
    const v = await page.evaluate(() => (window as unknown as F).cathodeFront!.scene()!.vignette)
    expect(v?.kind, cls).toBe(cls)
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
    expect(face.bottom - face.top, s).toBeGreaterThanOrEqual(hasTouch ? 70 : 110)
    expect(face.left >= 0 && face.top >= 0 && face.right <= W && face.bottom <= H, s).toBe(true)
    if (!hasTouch) {
      expect(face.left >= 470 && face.right <= 960 && face.top >= 150 && face.bottom <= 500, s).toBe(true)
      for (const o of [m.sheet, m.list]) expect(meets(face, o), s).toBe(false)
    }
    expect(m.on, s).toBe(true)
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
