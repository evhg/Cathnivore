import { expect, test } from '@playwright/test'

// Plan item 162: Cath a readable hero on the 3D field. Her face shows (18 px or more on a phone, 40 at D), it is
// lit lighter than her hair, and her pose follows the round: worried when a vehicle gets through. (Item 439: a
// phone opens on the whole field with her in view; 24 px was measured at the old close frame, which left her
// below the canvas's foot. Her figure's box is checked at 36 px+ in hedgerow-closeframe.)
type W = {
  hedgerow?: {
    game: () => { events: Array<Record<string, unknown>> } | null
    faceBox: () => { w: number; h: number } | null
    figureBox: () => { w: number; h: number } | null
    faceTone: () => { face: number; hair: number } | null
  }
}

test('her face reads in 3D, lighter than her hair, and she worries at a leak', async ({ page, hasTouch }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game() && !!(window as unknown as W).hedgerow!.faceBox(), null, { timeout: 90_000 })
  await page.waitForTimeout(3000)
  const m = await page.evaluate(() => {
    const h = (window as unknown as W).hedgerow!
    return { box: h.faceBox()!, tone: h.faceTone()! }
  })
  expect(Math.min(m.box.w, m.box.h)).toBeGreaterThanOrEqual(hasTouch ? 18 : 40)
  // Plan item 459: her whole figure 110 px tall at D, 55 on a phone (it was 48 there).
  const fig = await page.evaluate(() => (window as unknown as W).hedgerow!.figureBox()!)
  expect(fig.h).toBeGreaterThanOrEqual(hasTouch ? 55 : 110)
  expect(m.tone.face).toBeGreaterThan(m.tone.hair)
  // Calm before the leak: any pose but worried or cheer. Item 310's idle point and wave run on the render clock,
  // which crawls under CI's few-fps WebGL, so waiting for 'rest' itself timed out (E2E 3c91f977); worry overrides them.
  await expect(page.locator('#stage')).toHaveAttribute('data-cath-pose', /^(rest|plant|point|wave)$/, { timeout: 30_000 })
  await page.evaluate(() => (window as unknown as W).hedgerow!.game()!.events.push({ type: 'leak', x: 1, y: 1, lost: 1 }))
  await expect(page.locator('#stage')).toHaveAttribute('data-cath-pose', 'worried', { timeout: 30_000 })
})

// Plan item 208: as she gives a line on the field she points out over it with her free hand, then goes back to rest.
test('she points as she gives a hint', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 90_000 })
  await expect(page.locator('#stage')).toHaveAttribute('data-cath-pose', 'point', { timeout: 60_000 })
  await expect(page.locator('#stage')).toHaveAttribute('data-cath-pose', /rest|plant/, { timeout: 60_000 })
})

// Plan item 310: between rounds, while her line advises a plot, she points out over the field again every few seconds.
test('between rounds she points again while her line advises a plot', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 90_000 })
  const stage = page.locator('#stage')
  await expect(stage).toHaveAttribute('data-cath-pose', 'point', { timeout: 60_000 })
  await expect(stage).toHaveAttribute('data-cath-pose', /rest|plant/, { timeout: 60_000 })
  await expect(stage).toHaveAttribute('data-cath-pose', 'point', { timeout: 90_000 })
})

// Plan item 255: the 3D people drawn to the 2D field's standard: Cath inked on her largest parts, and every
// farmfolk mesh toon-shaded (their ink is baked into the same geometry).
test('Cath and the farmfolk are inked and toon-shaded in 3D', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  type P = { hedgerow?: { game: () => unknown; people3d?: () => { cathInk: number; folkToon: number; folkPlain: number } | null } }
  await page.waitForFunction(() => {
    const p = (window as unknown as P).hedgerow?.people3d?.()
    return !!p && p.folkToon > 0
  }, null, { timeout: 120_000 })
  const p = await page.evaluate(() => (window as unknown as P).hedgerow!.people3d!()!)
  expect(p.cathInk).toBeGreaterThanOrEqual(6)
  expect(p.folkPlain).toBe(0)
})

// Plan item 255: standing, she turns to the camera, her face within 30 deg of it seen from above (an upright phone's
// lens looked from her side, 44-120 deg off; the turn eases in, slowly at SwiftShader's few frames a second).
test('her face is turned toward the camera', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  type F = { hedgerow?: { game: () => unknown; camSettled?: () => boolean; faceToCamera?: () => number | null } }
  await page.waitForFunction(() => !!(window as unknown as F).hedgerow?.game() && !!(window as unknown as F).hedgerow!.camSettled?.(), null, { timeout: 120_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as F).hedgerow!.faceToCamera!() ?? 999), { timeout: 40_000 }).toBeLessThanOrEqual(30)
})

// Plan item 647: on the field at D her olive jacket stands off the grass beside her: a deeper cloth with a warm rim
// (`rimCloth`, models.ts). The jacket's mean colour (her chest and waist, 0.27-0.45 of her box's width, 0.35-0.58 of its height)
// against the grass just right of her figure was ΔE 14 before, 25 after (level 34 between rounds, CIE76 on the frame).
test('at D her jacket stands off the grass beside her', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop field')
  test.setTimeout(180_000)
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [String(i + 1), 3])), seenBefore: { 34: true }, seen: {}, tips: { all: true } })))
  await page.goto('/hedgerow/?sandbox=1&level=34')
  type X = { hedgerow?: { game: () => unknown; figureBox?: () => { x: number; y: number; w: number; h: number } | null } }
  await page.waitForFunction(() => !!(window as unknown as X).hedgerow?.game() && !!(window as unknown as X).hedgerow!.figureBox?.(), null, { timeout: 120_000 })
  await page.waitForTimeout(8000)
  const f = await page.evaluate(() => (window as unknown as X).hedgerow!.figureBox!()!)
  const png = (await page.screenshot()).toString('base64')
  const regions = {
    jacket: { x: f.x + f.w * 0.27, y: f.y + f.h * 0.35, w: f.w * 0.18, h: f.h * 0.23 },
    grass: { x: f.x + f.w + 4, y: f.y + f.h * 0.3, w: 16, h: f.h * 0.25 },
  }
  const de = await page.evaluate(async ({ png, regions }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + png
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    const lab = (r: { x: number; y: number; w: number; h: number }) => {
      const d = g.getImageData(Math.round(r.x), Math.round(r.y), Math.max(1, Math.round(r.w)), Math.max(1, Math.round(r.h))).data
      const lin = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
      let R = 0, G = 0, B = 0
      const n = d.length / 4
      for (let i = 0; i < d.length; i += 4) { R += lin(d[i]!); G += lin(d[i + 1]!); B += lin(d[i + 2]!) }
      R /= n; G /= n; B /= n
      const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089
      const k = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
      return [116 * k(Y) - 16, 500 * (k(X) - k(Y)), 200 * (k(Y) - k(Z))]
    }
    const a = lab(regions.jacket), b = lab(regions.grass)
    return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
  }, { png, regions })
  expect(de, JSON.stringify({ f, de })).toBeGreaterThanOrEqual(21)
})
