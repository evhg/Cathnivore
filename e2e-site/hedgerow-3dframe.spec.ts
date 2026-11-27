import { expect, test } from '@playwright/test'

// Plan item 78: in 3D the camera is fitted to the field, so the field's projected box (at the fitted view, before
// any zoom or pan) fills at least 65% of the canvas on a phone and on a desktop.
type HG = { game(): unknown; fieldShare(): number | null }
for (const level of [13, 21]) {
  test(`the 3D field fills its frame (level ${level})`, async ({ page }) => {
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    const share = await expect
      .poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.fieldShare()), { timeout: 60_000 })
      .not.toBeNull()
      .then(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.fieldShare()))
    expect(share!).toBeGreaterThanOrEqual(0.65)
  })
}

// Plan item 98: the gate sign's town name read about 9 px at D and edge on from a phone's high camera. The board
// faces the camera and its letters stand 8.5 px or more (about 12 px type) at P and D.
type HGS = HG & { gateSigns(): Array<{ x: number; y: number; cap: number }> | null }
test('the 3D gate sign reads at 12 px type or more (level 21)', async ({ page }) => {
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 21; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '21': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HGS }).hedgerow?.game(), null, { timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HGS }).hedgerow.gateSigns()?.length || document.querySelectorAll('.gate-plate-town').length), { timeout: 60_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  const signs = (await page.evaluate(() => (window as unknown as { hedgerow: HGS }).hedgerow.gateSigns()))!
  const vp = page.viewportSize()!
  const seen = signs.filter((s) => s.x >= 0 && s.x <= vp.width && s.y >= 0 && s.y <= vp.height)
  for (const s of seen) expect(s.cap).toBeGreaterThanOrEqual(8.4)
  // Plan item 103: on a phone level 21's gate stands on the field, so its board steps down (it covered the next
  // column's plots). Plan item 450: the town is named once per view: by the board, or (with the board down, or the
  // lane's depot in frame) by the queue's plate, never both.
  const plates = await page.locator('.gate-plate-town').count()
  if (vp.width < 600) expect(seen.length).toBe(0)
  expect(seen.length + plates).toBe(1)
})

// Plan item 102: she cheers a cleared round and raises a worried hand when a vehicle gets through. Her reaction
// starts on the frame the event lands (it eases in over 0.15 s); swiftshader runs at a few fps, so the wait here
// is frames, not the 250 ms a real GPU shows.
test('the 3D Cath cheers a cleared round, worries at a leak and stoops to plant', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one size is enough')
  test.setTimeout(180_000)
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 13: true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=13')
  type R3 = { heroMood: string; cath?: unknown }
  type HG3 = { game(): { events: unknown[] } | null }
  await page.waitForFunction(() => !!(window as unknown as { hedgerow3d?: R3 }).hedgerow3d?.cath, null, { timeout: 120_000 })
  const mood = () => page.evaluate(() => (window as unknown as { hedgerow3d: R3 }).hedgerow3d.heroMood)
  await page.evaluate(() => (window as unknown as { hedgerow: HG3 }).hedgerow.game()!.events.push({ type: 'cleared', wave: 1, reward: 0 }))
  await expect.poll(mood, { timeout: 15_000, intervals: [100] }).toBe('cheer')
  await expect.poll(mood, { timeout: 20_000 }).toBe('rest')
  await page.evaluate(() => (window as unknown as { hedgerow: HG3 }).hedgerow.game()!.events.push({ type: 'leak', x: 1, y: 1, lost: 1 }))
  await expect.poll(mood, { timeout: 15_000, intervals: [100] }).toBe('worried')
  await expect.poll(mood, { timeout: 20_000 }).toBe('rest')
  // A tower going in: she stoops to plant it.
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: { game(): { level: { cols: number; rows: number } }; place(g: unknown, k: string, c: number, r: number): { ok: boolean } } }).hedgerow
    const g = hg.game()
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) if (hg.place(g, 'hedgerow', c, r).ok) return
  })
  await expect.poll(mood, { timeout: 15_000, intervals: [100] }).toBe('plant')
})

// Plan item 102: her face is big enough to read at the field's own framing: 24 px tall or more at D, 14 on a phone.
for (const level of [13, 21]) {
  test(`the 3D Cath's face reads at the field's framing (level ${level})`, async ({ page, hasTouch }) => {
    test.setTimeout(150_000)
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    type FB = { faceBox(): { w: number; h: number } | null }
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow?: FB }).hedgerow?.faceBox() ?? null), { timeout: 120_000 }).not.toBeNull()
    await page.waitForTimeout(3000)
    const box = await page.evaluate(() => (window as unknown as { hedgerow: FB }).hedgerow.faceBox()!)
    expect(box.h).toBeGreaterThanOrEqual(hasTouch ? 14 : 24)
  })
}

// Plan item 132: at D the "N coming" plate sat on plots and the pond, and Cath's bubble covered the gate sign's
// town name. The plate now covers at most a sliver of any plot (its inset tile) and meets no sign; the bubble
// meets no sign either. Both stay inside the field.
type HGQ = HGS & {
  gateQueue(): { leads: Box[]; plates: Box[] } | null
  gateSignBoxes(): Box[]
  plotBoxes(): Box[]
  cathSay(): { box: Box } | null
  camSettled(): boolean
}
type Box = { x: number; y: number; w: number; h: number }
for (const level of [13, 21]) {
  test(`the 3D gate plate keeps off plots and the sign, the bubble off the sign (level ${level})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HGQ }).hedgerow?.game(), null, { timeout: 60_000 })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HGQ }).hedgerow.gateQueue()?.plates.length ?? 0), { timeout: 60_000 }).toBeGreaterThan(0)
    // Plan item 160: a boss round's queue draws the camera towards the gate for 2.6 s of field time, and the plate
    // follows it, so a fixed wait measured it mid-look about 2 runs in 5 at a few fps (0.28 of plots at P level 21,
    // 0.07-0.10 once it lets go). Measure once the camera has settled.
    // Settled means the camera has let go and the plots (and so the plate) stood still over three reads.
    const pose = () => page.evaluate(() => {
      const h = (window as unknown as { hedgerow: HGQ }).hedgerow
      const b = h.plotBoxes()[0]
      return h.camSettled() ? `${b?.x.toFixed(1)},${b?.y.toFixed(1)},${b?.w.toFixed(1)}` : 'moving'
    })
    const seen: string[] = []
    await expect.poll(async () => {
      seen.push(await pose())
      const last = seen.slice(-3)
      return last.length === 3 && last[0] !== 'moving' && last.every((v) => v === last[0])
    }, { timeout: 60_000, intervals: [600] }).toBe(true)
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: HGQ }).hedgerow
      const c = document.getElementById('canvas')!.getBoundingClientRect()
      const toClient = (b: Box) => ({ ...b, x: b.x + c.left, y: b.y + c.top })
      const stage = document.getElementById('stage')!.getBoundingClientRect()
      const say = h.cathSay()
      return {
        canvas: { x: c.left, y: c.top, w: c.width, h: c.height },
        plates: h.gateQueue()!.plates.map(toClient),
        signs: h.gateSignBoxes().map(toClient),
        plots: h.plotBoxes(),
        bubble: say ? { ...say.box, x: say.box.x + stage.left, y: say.box.y + stage.top } : null,
      }
    })
    const meet = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    for (const p of r.plates) {
      expect(p.x).toBeGreaterThanOrEqual(r.canvas.x)
      expect(p.x + p.w).toBeLessThanOrEqual(r.canvas.x + r.canvas.w)
      for (const s of r.signs) expect(meet(p, s)).toBe(0)
      // A plot box here is its whole cell; the tile is inset in it, so a plate on the grass between tiles still
      // meets a little of a cell's box. 12% of the plate is about that border.
      const covered = r.plots.reduce((a, b) => a + meet(p, b), 0)
      expect(covered / (p.w * p.h)).toBeLessThanOrEqual(0.12)
    }
    if (r.bubble) for (const s of r.signs) expect(meet(r.bubble, s)).toBe(0)
  })
}

// Plan item 591: on an upright phone a far-edge gate's depot stood past the canvas's top, its roof under the HUD
// (level 21: 9 px cut off). The fitted view steps back until every depot's top stands 8 px or more below the HUD.
type HGD = HG & { depots3d(): Array<{ x: number; y: number; w: number; h: number }> }
for (const level of [21, 34]) {
  test(`the phone 3D view keeps the depots clear of the HUD (level ${level})`, async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'an upright phone only')
    test.setTimeout(150_000)
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => ((window as unknown as { hedgerow?: HGD }).hedgerow?.depots3d?.() ?? []).length > 0, null, { timeout: 90_000 })
    await page.waitForTimeout(3000)
    const r = await page.evaluate(() => {
      const hud = document.querySelector('.hud')!.getBoundingClientRect().bottom
      const top = document.querySelector('canvas')!.getBoundingClientRect().top
      return { hud, tops: (window as unknown as { hedgerow: HGD }).hedgerow.depots3d().map((d) => top + d.y) }
    })
    for (const t of r.tops) expect(t).toBeGreaterThanOrEqual(r.hud + 8)
  })
}

// Plan item 613: a desktop win settles the 3D camera in on the farmhouse she kept (a held move, not a passing one).
test('a 3D win settles the camera on the farmhouse (level 12, D)', async ({ page }, info) => {
  test.skip(info.project.name !== 'site-desktop', 'a desktop camera move')
  test.setTimeout(120_000)
  type HGC = Omit<HG, 'game'> & { cam3d(): { x: number; y: number; z: number; moving: boolean } | null; game(): { phase: string } }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { '12': true }, seen: {}, tips: { all: true } })))
  await page.goto('/hedgerow/?sandbox=1&level=12')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HGC }).hedgerow?.cam3d(), null, { timeout: 60_000 })
  const cam = () => page.evaluate(() => (window as unknown as { hedgerow: HGC }).hedgerow.cam3d()!)
  await page.waitForTimeout(1500)
  const before = await cam()
  await page.evaluate(() => {
    ;(window as unknown as { hedgerow: HGC }).hedgerow.game().phase = 'won'
  })
  await expect.poll(async () => (await cam()).moving, { timeout: 30_000 }).toBe(true)
  // It leans in (the camera comes lower) and stays held while the result shows.
  await expect.poll(async () => before.y - (await cam()).y, { timeout: 60_000 }).toBeGreaterThan(0.5)
  await page.waitForTimeout(2500)
  expect((await cam()).moving).toBe(true)
})

// Plan item 735: on a phone every depot stands whole in the opening 3D view (level 34's second depot stood a third
// off the left edge: the lean served the first gate's depot alone).
type HGF = HG & { depotFrames(): Array<{ box: [number, number, number, number]; inside: number }> | null; camSettled(): boolean }
for (const level of [1, 12, 27, 34]) {
  test(`every depot stands whole in the opening view (level ${level})`, async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) > 600, 'the phone frame')
    test.setTimeout(120_000)
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HGF }).hedgerow?.depotFrames()?.length, null, { timeout: 90_000 })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HGF }).hedgerow.camSettled()), { timeout: 60_000 }).toBe(true)
    const depots = (await page.evaluate(() => (window as unknown as { hedgerow: HGF }).hedgerow.depotFrames()))!
    for (const d of depots) expect(d.inside, JSON.stringify(d.box)).toBeGreaterThanOrEqual(0.98)
  })
}

// Plan item 735: the phone's 3D field isn't washed out against D. The mean linear luminance of the empty plots (a
// 7x7 px patch at each one's centre, off the lanes and clear of the HUD) sits within 10% of the desktop's at levels 1, 12 and 27; at 34
// the flood meadow's crops fill most of each plot's patch and the bound is 15%.
type HGL = HGF & { cellCenter(c: number, r: number): { x: number; y: number } | null; noCloudShadows3d(): boolean }
async function plotLuminance(page: import('@playwright/test').Page, level: number, shot: string): Promise<number> {
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate((l) => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < l; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
  }, level)
  await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HGF }).hedgerow?.depotFrames()?.length, null, { timeout: 90_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HGF }).hedgerow.camSettled()), { timeout: 60_000 }).toBe(true)
  // The drifting cloud shadows off, so the sampled frame doesn't depend on when it was taken.
  await page.evaluate(() => (window as unknown as { hedgerow: HGL }).hedgerow.noCloudShadows3d())
  await page.waitForTimeout(2000)
  // Plots the field shows: the canvas is the topmost element at the plot's centre with every overlay made hit-testable
  // (the coach bubble is pointer-events: none, so a plain elementFromPoint saw through it and sampled its white paper
  // as field: P read 0.244 with the bubble up and 0.199 without, so the test passed or failed by when the bubble showed).
  const shown = () =>
    page.evaluate(() => {
      type G = { level: { rows: number; cols: number } }
      const h = (window as unknown as { hedgerow: HGL }).hedgerow
      const lv = (h.game() as G).level
      const st = document.createElement('style')
      st.textContent = '* { pointer-events: auto !important }'
      document.head.append(st)
      const out: string[] = []
      for (let r = 0; r < lv.rows; r++)
        for (let c = 0; c < lv.cols; c++) {
          const q = h.cellCenter(c, r)
          if (!q) continue
          // the full-field layers (fx, depot plates' host) are empty boxes; anything else above the canvas hides it
          const stack = document.elementsFromPoint(q.x, q.y)
          const at = stack.findIndex((e) => e.id === 'canvas')
          if (at >= 0 && stack.slice(0, at).every((e) => e.id === 'fx-layer' || e.id === 'depots')) out.push(`${c},${r}`)
        }
      st.remove()
      return out
    })
  const before = await shown()
  const png = (await page.screenshot({ path: shot, timeout: 120_000 })).toString('base64')
  const after = new Set(await shown())
  const visible = before.filter((k) => after.has(k))
  return page.evaluate(async ([b64, visible]) => {
    type G = { level: { path: Array<[number, number]>; path2?: Array<[number, number]>; rows: number; cols: number }; towers: Array<{ col: number; row: number }> }
    const h = (window as unknown as { hedgerow: HGL }).hedgerow
    const g = h.game() as G
    const lv = g.level
    const skip = new Set([...lv.path, ...(lv.path2 ?? []), ...g.towers.map((t) => [t.col, t.row] as [number, number])].map(([c, r]) => `${c},${r}`))
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const x = new OffscreenCanvas(img.width, img.height).getContext('2d')!
    x.drawImage(img, 0, 0)
    const k = img.width / innerWidth
    const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    let L = 0
    let n = 0
    for (let r = 0; r < lv.rows; r++)
      for (let c = 0; c < lv.cols; c++) {
        const q = skip.has(`${c},${r}`) ? null : h.cellCenter(c, r)
        // only plots the field shows: not under the coach bubble, the tray or a label
        if (!q || !visible.includes(`${c},${r}`)) continue
        const px = Math.round(q.x * k)
        const py = Math.round(q.y * k)
        if (px < 4 || py < 4 || px > img.width - 4 || py > img.height - 4) continue
        const d = x.getImageData(px - 3, py - 3, 7, 7).data
        for (let i = 0; i < d.length; i += 4, n++) L += 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!)
      }
    return L / n
  }, [png, visible] as const)
}
test.describe('phone plot luminance', () => {
  // One worker: each level renders two 3D frames, and side by side they starve each other's frames.
  test.describe.configure({ mode: 'serial' })
  for (const [level, bound] of [[1, 0.1], [12, 0.1], [27, 0.1], [34, 0.15]] as const) {
    test(`the phone's 3D plots read as light as the desktop's (level ${level})`, async ({ browser, page }, info) => {
      test.skip((page.viewportSize()?.width ?? 0) > 600, 'one run: it opens both frames itself')
      test.setTimeout(300_000)
      const baseURL = info.project.use.baseURL
      const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
      const desk = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } })
      const p = await plotLuminance(await phone.newPage(), level, info.outputPath('phone.png'))
      const d = await plotLuminance(await desk.newPage(), level, info.outputPath('desk.png'))
      await phone.close()
      await desk.close()
      console.log(`735 plots level ${level}: P ${p.toFixed(3)} D ${d.toFixed(3)}`)
      expect(Math.abs(p - d) / d, `P ${p.toFixed(3)} D ${d.toFixed(3)}`).toBeLessThanOrEqual(bound)
    })
  }
})
