import { expect, test, type Page } from './own-gpu'

// Plan item 334: the operative pick as a lit armoury. At D the case table's gun is lit (a 35%+ luminance spread
// between its lit and shadow faces) and the rack's row guns are distinct silhouettes (IoU 0.7 or less between
// different guns; the Wirewitch and the Fixer both start with the Kestrel, so theirs match by design). On an upright
// phone the stat card is smoked glass: its background 0.08 luminance or less, its words 7:1 or more against it.
type Front = { cathodeFront?: { ready?: boolean } }

async function openPick(page: Page, cls = 'ghost'): Promise<void> {
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto(`/nightshift/?front=classpick&shot&t=8&class=${cls}&rs=0.5`)
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
}

test('at D the case gun is lit and the rack guns are distinct silhouettes', async ({ page }) => {
  test.skip(page.viewportSize()!.width <= 700, 'the desktop rack')
  test.setTimeout(300_000)
  await openPick(page)
  await expect(page.locator('.cp-weapon-art.is-lit .cp-gun')).toHaveCount(1)
  await expect(page.locator('.cp-opt-gun')).toHaveCount(5, { timeout: 60_000 })
  const m = await page.evaluate(async () => {
    const load = async (src: string) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const x = c.getContext('2d', { willReadFrequently: true })!
      x.drawImage(img, 0, 0)
      return { c, d: x.getImageData(0, 0, c.width, c.height).data }
    }
    const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
    // Perceived lightness (CIE L*, 0-1): gunmetal is dark, so its faces differ in how light they look, not in
    // linear light.
    const lstar = (y: number) => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y) / 100
    // The lit gun: the spread between its bright (95th) and dark (5th percentile) faces, over its own pixels.
    const gun = await load(document.querySelector<HTMLImageElement>('.cp-gun')!.src)
    const ls: number[] = []
    for (let i = 0; i < gun.d.length; i += 4) {
      if (gun.d[i + 3]! > 200) ls.push(lstar(0.2126 * lin(gun.d[i]!) + 0.7152 * lin(gun.d[i + 1]!) + 0.0722 * lin(gun.d[i + 2]!)))
    }
    ls.sort((a, b) => a - b)
    const spread = ls[Math.floor(ls.length * 0.95)]! - ls[Math.floor(ls.length * 0.05)]!
    // Each row gun's silhouette, cropped to its own box and fitted, keeping its proportions (a long barrel reads as
    // long), into a 96 x 40 grid, centred.
    const W = 96
    const H = 40
    const masks: { weapon: string; m: Uint8Array }[] = []
    for (const g of document.querySelectorAll<HTMLElement>('.cp-opt-gear')) {
      const { c, d } = await load(g.querySelector<HTMLImageElement>('.cp-opt-gun')!.src)
      let x0 = c.width
      let y0 = c.height
      let x1 = 0
      let y1 = 0
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3]! > 64) {
            x0 = Math.min(x0, x)
            y0 = Math.min(y0, y)
            x1 = Math.max(x1, x)
            y1 = Math.max(y1, y)
          }
        }
      }
      const m = new Uint8Array(W * H)
      const k = Math.max((x1 - x0 + 1) / W, (y1 - y0 + 1) / H)
      const ox = (x0 + x1) / 2 - (W / 2) * k
      const oy = (y0 + y1) / 2 - (H / 2) * k
      for (let j = 0; j < H; j++) {
        for (let i = 0; i < W; i++) {
          const x = Math.round(ox + (i + 0.5) * k)
          const y = Math.round(oy + (j + 0.5) * k)
          m[j * W + i] = x >= 0 && y >= 0 && x < c.width && y < c.height && d[(y * c.width + x) * 4 + 3]! > 64 ? 1 : 0
        }
      }
      masks.push({ weapon: g.dataset.weapon ?? '', m })
    }
    const ious: { pair: string; iou: number }[] = []
    for (let a = 0; a < masks.length; a++) {
      for (let b = a + 1; b < masks.length; b++) {
        if (masks[a]!.weapon === masks[b]!.weapon) continue
        let and = 0
        let or = 0
        for (let k = 0; k < W * H; k++) {
          and += masks[a]!.m[k]! & masks[b]!.m[k]!
          or += masks[a]!.m[k]! | masks[b]!.m[k]!
        }
        ious.push({ pair: `${masks[a]!.weapon}/${masks[b]!.weapon}`, iou: and / Math.max(1, or) })
      }
    }
    return { spread, ious }
  })
  expect(m.spread, JSON.stringify(m)).toBeGreaterThanOrEqual(0.35)
  expect(m.ious.length).toBeGreaterThanOrEqual(6)
  for (const p of m.ious) expect(p.iou, p.pair).toBeLessThanOrEqual(0.7)
})

test('on a phone the class card is smoked glass with 7:1 words', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 700, 'the upright phone')
  test.setTimeout(300_000)
  await openPick(page)
  const card = page.locator('.cp-sheet[data-dossier]')
  await expect(card).toBeVisible()
  const box = (await card.boundingBox())!
  const inks = await page.evaluate(() =>
    [...document.querySelectorAll('.cp-sheet :is(.cp-attr dt, .cp-attr-n, .cp-weapon-name, .cp-weapon-nums dt, .cp-weapon-nums dd, .cp-tree-name)')].map(
      (e) => getComputedStyle(e).color,
    ),
  )
  // The card's own ground: everything on it hidden, the card itself kept.
  await page.addStyleTag({ content: '.cp-sheet[data-dossier] > * { visibility: hidden !important; }' })
  const png = (await page.screenshot({ clip: box })).toString('base64')
  const r = await page.evaluate(
    async ([png, inks]) => {
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
      // Skip the red rule along the top (the first 4% of rows).
      const ls: number[] = []
      for (let y = Math.ceil(c.height * 0.04); y < c.height; y++) {
        for (let xx = 0; xx < c.width; xx++) {
          const i = (y * c.width + xx) * 4
          ls.push(lum(d[i]!, d[i + 1]!, d[i + 2]!))
        }
      }
      ls.sort((a, b) => a - b)
      const median = ls[Math.floor(ls.length / 2)]!
      const bright = ls[Math.floor(ls.length * 0.95)]!
      const worst = Math.min(
        ...inks.map((s) => {
          const [r, g, b] = s.match(/[\d.]+/g)!.map(Number)
          return (lum(r!, g!, b!) + 0.05) / (bright + 0.05)
        }),
      )
      return { median, bright, worst }
    },
    [png, inks] as const,
  )
  expect(r.median, JSON.stringify(r)).toBeLessThanOrEqual(0.08)
  expect(r.worst, JSON.stringify(r)).toBeGreaterThanOrEqual(7)
})
