import { expect, test } from '@playwright/test'

// Plan item 90: tiles read at a glance, in every weather. Sampled from screenshots: each dry tile's edge (its rim or
// lit bevel) against the valley under it (shot with the tiles hidden), and each channel against its tile's fill.
// The pale fills themselves stay close to the golden fields by design; the rim carries the separation (DECISIONS).

const SKIES = ['morning,clear', 'noon,clear', 'golden,clear', 'dusk,clear', 'noon,drizzle', 'morning,clouds']

for (const [name, size, edgeMin] of [['P', { width: 390, height: 844 }, 2.5], ['D', { width: 1440, height: 900 }, 3]] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`tiles stand off the valley and channels off the tiles, every weather (${name}, ${scheme})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'site-desktop', 'sets its own viewport; one run is enough')
      test.setTimeout(120_000)
      await page.setViewportSize(size)
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      for (const sky of SKIES) {
        await page.goto(`/runnel/?nohelp&sky=${sky}`)
        await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
        // Sample the settled light: the sky's wash eases in over 1.2 s.
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' })
        await page.waitForTimeout(300)
        const full = (await page.screenshot()).toString('base64')
        const hide = await page.addStyleTag({ content: '#board .tiles, #board .tile-shadow { visibility: hidden !important; }' })
        const bare = (await page.screenshot()).toString('base64')
        await hide.evaluate((n) => (n as Element).remove())
        const r = await page.evaluate(async ([full, bare]) => {
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
          const B = await load(bare)
          const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
          // Screenshots are in device pixels.
          const k = F.width / innerWidth
          const L = (d: ImageData, x: number, y: number) => {
            const i = (Math.round(y * k) * d.width + Math.round(x * k)) * 4
            return 0.2126 * lin(d.data[i]!) + 0.7152 * lin(d.data[i + 1]!) + 0.0722 * lin(d.data[i + 2]!)
          }
          const cr = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
          const edges: number[] = []
          const chans: number[] = []
          for (const g of document.querySelectorAll<SVGGElement>('#board .tiles > g.cell:not(.stone):not(.wet)')) {
            const t = g.querySelector<SVGPolygonElement>('.tile')!
            const bb = t.getBoundingClientRect()
            const cx = bb.x + bb.width / 2
            const cy = bb.y + bb.height / 2
            const corners = [...Array(t.points.numberOfItems).keys()].map((i) => t.points.getItem(i).matrixTransform(t.getScreenCTM()!))
            // The valley under the tile, and the tile's fill toward its corners (channels only run to edge midpoints).
            const field = med(corners.flatMap((q) => [0.3, 0.5].map((f) => L(B, cx + (q.x - cx) * f, cy + (q.y - cy) * f))))
            const fill = med(corners.map((q) => L(F, cx + (q.x - cx) * 0.6, cy + (q.y - cy) * 0.6)))
            // The edge: the strongest pixel against the valley on a line from 80% of the way out to just past the rim.
            const sides = corners.map((a, i) => {
              const b = corners[(i + 1) % corners.length]!
              const mx = (a.x + b.x) / 2
              const my = (a.y + b.y) / 2
              let best = 0
              for (let f = 0.8; f <= 1.06; f += 0.005) best = Math.max(best, cr(L(F, cx + (mx - cx) * f, cy + (my - cy) * f), field))
              return best
            })
            edges.push(med(sides))
            // A channel: along its bed, the strongest pixel across it against the tile's fill.
            const bed = g.querySelector<SVGLineElement>('.groove-bed')
            if (bed) {
              // The bed's box centre is the ditch's midpoint whatever the piece's CSS rotation (getScreenCTM leaves
              // that rotation out), so the ditch runs from the tile's centre through it to the edge.
              const bb2 = bed.getBoundingClientRect()
              const p0 = { x: cx, y: cy }
              const p1 = { x: 2 * (bb2.x + bb2.width / 2) - cx, y: 2 * (bb2.y + bb2.height / 2) - cy }
              const dx = p1.x - p0.x
              const dy = p1.y - p0.y
              const dl = Math.hypot(dx, dy)
              // Across the whole ditch (its bed and both banks, about 11% of the tile's width), not just the bed.
              const reach = Math.max(4, Math.round(bb.width * 0.055))
              const along: number[] = []
              for (let f = 0.35; f <= 0.8; f += 0.05) {
                let best = 0
                for (let o = -reach; o <= reach; o++) best = Math.max(best, cr(L(F, p0.x + dx * f - (dy / dl) * o, p0.y + dy * f + (dx / dl) * o), fill))
                along.push(best)
              }
              chans.push(med(along))
            }
          }
          return { n: edges.length, edge: Math.min(...edges), chan: Math.min(...chans) }
        }, [full, bare] as const)
        expect(r.n, sky).toBeGreaterThan(5)
        expect(r.edge, `tile edge vs valley, ${sky}`).toBeGreaterThanOrEqual(edgeMin)
        expect(r.chan, `channel vs tile, ${sky}`).toBeGreaterThanOrEqual(3)
      }
    })
  }
}
