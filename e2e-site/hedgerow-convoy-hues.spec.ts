import { expect, test } from '@playwright/test'

// Plan item 730: in 3D the convoy's kinds read apart at a glance. On level 27 (act 3's liveries) with its first round's
// mix on the lane (sealed Box Lorries, Same-Day vans, the pickups and hatchbacks they pop into), the vehicles' bodies
// sampled on screen fall in three or more hues 40 degrees+ apart, and the lorries stand 40 degrees+ off the vans
// (they sampled 38 apart in navy and violet, and the sealed round read as one fleet of purple boxes).
type Box = { kind: string; x: number; y: number; w: number; h: number }
type HG = {
  game(): { enemies: Array<{ pm: number }> }
  spawn(kind: string, dist: number): void
  freeze(): void
  camSettled(): boolean
  renderer(): { rungBoxes(): Box[] }
}
const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

test('level 27: the 3D convoy kinds stand apart in hue', async ({ page }) => {
  test.setTimeout(180_000)
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 27: true }, seen: {}, tips: t })), [stars, tips] as const)
  await page.goto('/hedgerow/?sandbox=1&level=27')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.camSettled()), { timeout: 90_000 }).toBe(true)
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    const mix = ['lorry', 'sprinter', 'pickup', 'sprinter', 'lorry', 'van', 'sprinter', 'pickup', 'lorry', 'sprinter', 'hatchback', 'lorry']
    mix.forEach((k, i) => {
      h.spawn(k, 1.2 + i * 1.6)
      if (k === 'lorry') g.enemies.at(-1)!.pm |= 8 // sealed
    })
    h.freeze()
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.renderer().rungBoxes().length), { timeout: 60_000 }).toBeGreaterThanOrEqual(10)
  await page.waitForTimeout(1500)
  const info = await page.evaluate(() => {
    const c = document.getElementById('canvas')!.getBoundingClientRect()
    const all = (window as unknown as { hedgerow: HG }).hedgerow.renderer().rungBoxes()
    const meet = (a: Omit<Box, 'kind'>, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    // a vehicle whose middle another covers is skipped: its pixels are a neighbour's
    const solo = all.filter((a) => a.x >= 0 && a.y >= 0 && a.x + a.w <= c.width && a.y + a.h <= c.height && all.every((b) => b === a || meet({ x: a.x + a.w / 4, y: a.y + a.h / 4, w: a.w / 2, h: a.h / 2 }, b) < a.w * a.h * 0.04))
    return { cx: c.x, cy: c.y, solo }
  })
  const png = await page.screenshot()
  const hues: Array<{ kind: string; hue: number }> = await page.evaluate(async ({ b64, info }) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const cv = new OffscreenCanvas(img.width, img.height)
    const x = cv.getContext('2d')!
    x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, img.width, img.height).data
    const k = img.width / innerWidth
    const out: Array<{ kind: string; hue: number }> = []
    for (const b of info.solo) {
      const x0 = Math.round((info.cx + b.x + b.w * 0.2) * k), x1 = Math.round((info.cx + b.x + b.w * 0.8) * k)
      const y0 = Math.round((info.cy + b.y + b.h * 0.2) * k), y1 = Math.round((info.cy + b.y + b.h * 0.8) * k)
      let sx = 0, sy = 0, n = 0, tot = 0
      for (let y = y0; y < y1; y++)
        for (let xx = x0; xx < x1; xx++) {
          const o = (y * img.width + xx) * 4
          const r = d[o]! / 255, g = d[o + 1]! / 255, bl = d[o + 2]! / 255
          const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl)
          tot++
          if (mx < 0.15 || (mx - mn) / mx < 0.25) continue
          let h = mx === r ? ((g - bl) / (mx - mn)) % 6 : mx === g ? (bl - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4
          h *= 60
          sx += Math.cos((h * Math.PI) / 180)
          sy += Math.sin((h * Math.PI) / 180)
          n++
        }
      if (n >= tot * 0.15) out.push({ kind: b.kind, hue: ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360 })
    }
    return out
  }, { b64: png.toString('base64'), info })
  const mean = (kind: string) => {
    const hs = hues.filter((h) => h.kind === kind).map((h) => (h.hue * Math.PI) / 180)
    return hs.length ? ((Math.atan2(hs.reduce((a, h) => a + Math.sin(h), 0), hs.reduce((a, h) => a + Math.cos(h), 0)) * 180) / Math.PI + 360) % 360 : null
  }
  const seeds: number[] = []
  for (const h of hues.map((x) => x.hue).sort((a, b) => a - b)) if (!seeds.some((s) => gap(s, h) < 40)) seeds.push(h)
  const msg = JSON.stringify(hues.map((h) => `${h.kind} ${Math.round(h.hue)}`))
  expect(seeds.length, msg).toBeGreaterThanOrEqual(3)
  const lorry = mean('lorry'), van = mean('sprinter')
  expect(lorry, msg).not.toBeNull()
  expect(van, msg).not.toBeNull()
  expect(gap(lorry!, van!), msg).toBeGreaterThanOrEqual(40)
})
