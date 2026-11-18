import { expect, test } from './own-gpu'

// Plan item 505: at D the title has one focal point. The paper (the Ledger) and The List are graded down and kept on
// the case wall at the left, so her face is brighter than either and nothing of the wall reaches her side of the street.

type B = { left: number; top: number; right: number; bottom: number }
type W = { cathodeFront?: { ready: boolean; scene(): { faceBox(): B; figureBox(body?: boolean): B } | null } }

for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  test(`at ${vp.width}x${vp.height} her face outshines the paper and the List, and the wall stays left of her`, async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'the desktop title')
    test.setTimeout(300_000)
    await page.setViewportSize(vp)
    await page.goto('/nightshift/?shot')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?front=title&shot&t=8&quality=phone')
    await page.waitForFunction(() => (window as unknown as W).cathodeFront?.ready === true, null, { timeout: 150_000 })
    // The focused New Case opens the paper; ?shot draws its held frame a moment after ready.
    await page.waitForSelector('#dossier.is-open[data-front-page]', { timeout: 90_000 })
    await page.waitForTimeout(3000)
    const boxes = await page.evaluate(() => {
      const box = (e: Element | null): B | null => { if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }
      const s = (window as unknown as W).cathodeFront!.scene()!
      return { face: s.faceBox(), fig: s.figureBox(true), paper: box(document.querySelector('#dossier')), list: box(document.querySelector('#the-list-wall')) }
    })
    expect(boxes.paper && boxes.list, JSON.stringify(boxes)).toBeTruthy()
    // The wall stays on the left: the paper and the List end before her figure (her umbrella's canopy may overhang it).
    expect(boxes.paper!.right, JSON.stringify(boxes)).toBeLessThanOrEqual(boxes.fig.left)
    expect(boxes.list!.right, JSON.stringify(boxes)).toBeLessThanOrEqual(boxes.fig.left)
    const png = (await page.screenshot()).toString('base64')
    const f = boxes.face, fw = f.right - f.left, fh = f.bottom - f.top
    const face = { left: f.left + fw * 0.2, top: f.top + fh * 0.2, right: f.right - fw * 0.2, bottom: f.bottom - fh * 0.2 }
    const m = await page.evaluate(async ({ png, regions }) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + png
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      return regions.map((r) => {
        const x = Math.max(0, Math.round(r.left)), y = Math.max(0, Math.round(r.top))
        const w = Math.min(c.width, Math.round(r.right)) - x, h = Math.min(c.height, Math.round(r.bottom)) - y
        const d = g.getImageData(x, y, w, h).data
        let sum = 0
        for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!
        return sum / (d.length / 4)
      })
    }, { png, regions: [face, boxes.paper!, boxes.list!] })
    const [faceL, paperL, listL] = m as [number, number, number]
    const msg = JSON.stringify({ face: faceL, paper: paperL, list: listL })
    expect(faceL, msg).toBeGreaterThan(paperL)
    expect(faceL, msg).toBeGreaterThan(listL)
  })
}
