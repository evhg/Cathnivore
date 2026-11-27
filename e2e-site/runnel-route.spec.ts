import { expect, test } from '@playwright/test'

// Plan item 723: the route reads on the dry board before any water runs. Each dry ditch is a dark earth trench, 3:1 or
// more off its tile's face (sampled from shot pixels along the bed, the tile's face read with its channels hidden), the
// trench 6 px+ across on a phone, and every dry field shows its wilted crop.
for (const [name, size] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]] as const) {
  test(`the dry route is a dark trench you can trace (${name})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'site-desktop', 'sets its own viewport; one run is enough')
    await page.setViewportSize(size)
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.clock.setFixedTime(new Date('2026-11-17T10:00:00Z'))
    await page.goto('/runnel/?nohelp&sky=noon,clear')
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' })
    await page.waitForTimeout(300)
    const full = (await page.screenshot()).toString('base64')
    const strip = await page.addStyleTag({ content: '#board .tiles .piece, #board .tiles .pin { visibility: hidden !important; }' })
    const plain = (await page.screenshot()).toString('base64')
    await strip.evaluate((n) => (n as Element).remove())
    const r = await page.evaluate(async ([full, plain]) => {
      const load = async (s: string) => {
        const i = new Image()
        i.src = `data:image/png;base64,${s}`
        await i.decode()
        const c = document.createElement('canvas')
        c.width = i.width
        c.height = i.height
        const x = c.getContext('2d')!
        x.drawImage(i, 0, 0)
        return x.getImageData(0, 0, c.width, c.height)
      }
      const F = await load(full)
      const P = await load(plain)
      const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
      const k = F.width / innerWidth
      const L = (d: ImageData, x: number, y: number) => {
        const i = (Math.round(y * k) * d.width + Math.round(x * k)) * 4
        return 0.2126 * lin(d.data[i]!) + 0.7152 * lin(d.data[i + 1]!) + 0.0722 * lin(d.data[i + 2]!)
      }
      const cr = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
      const tiles: number[] = []
      const widths: number[] = []
      for (const g of document.querySelectorAll<SVGGElement>('#board .tiles > g.cell:not(.stone):not(.wet)')) {
        const t = g.querySelector<SVGPolygonElement>('.tile')!
        const bb = t.getBoundingClientRect()
        const cx = bb.x + bb.width / 2
        const cy = bb.y + bb.height / 2
        const corners = [...Array(t.points.numberOfItems).keys()].map((i) => t.points.getItem(i).matrixTransform(t.getScreenCTM()!))
        const face = med(corners.map((q) => L(P, cx + (q.x - cx) * 0.6, cy + (q.y - cy) * 0.6)))
        let best = 0
        for (const bed of g.querySelectorAll<SVGLineElement>('.groove-bed')) {
          const b2 = bed.getBoundingClientRect()
          const ex = 2 * (b2.x + b2.width / 2) - cx
          const ey = 2 * (b2.y + b2.height / 2) - cy
          const along: number[] = []
          for (let f = 0.4; f <= 0.75; f += 0.05) along.push(L(F, cx + (ex - cx) * f, cy + (ey - cy) * f))
          best = Math.max(best, cr(med(along), face))
          const m = bed.getScreenCTM()!
          widths.push(parseFloat(getComputedStyle(bed).strokeWidth) * Math.hypot(m.a, m.b))
        }
        if (g.querySelector('.groove-bed')) tiles.push(best)
      }
      const fields = [...document.querySelectorAll<SVGGElement>('#board .tiles > g.cell.field:not(.wet):not(.reservoir)')]
      const wilted = fields.filter((f) => {
        const w = f.dataset.crop === 'wilted' ? f.querySelector<SVGGraphicsElement>('.field-plot .crop') : null
        return w && getComputedStyle(w).visibility !== 'hidden' && Number(getComputedStyle(w).opacity) > 0.5 && w.getBoundingClientRect().width > 0
      })
      return { n: tiles.length, worst: Math.min(...tiles), median: med(tiles), width: Math.min(...widths), fields: fields.length, wilted: wilted.length }
    }, [full, plain] as const)
    expect(r.n).toBeGreaterThan(5)
    expect(r.worst, `the weakest trench vs its tile (median ${r.median.toFixed(2)})`).toBeGreaterThanOrEqual(3)
    expect(r.width, 'the trench floor across, px').toBeGreaterThanOrEqual(6)
    expect(r.fields).toBeGreaterThan(0)
    expect(r.wilted, 'a wilted crop on every dry field').toBe(r.fields)
  })
}
