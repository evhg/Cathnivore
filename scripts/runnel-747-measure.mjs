// Plan item 747: the dry route's legibility in numbers, on today's daily at P and D (no clouds, noon):
// - tone steps across each dry run tile's channel (a perpendicular section through its middle, smoothed, counting
//   plateaus that differ by more than 6 L*), the median over the board;
// - floor vs field contrast (WCAG ratio of the section's darkest plateau to the tile face just outside it);
// - glyph overlap: the share of crop pixels (elementsFromPoint on a 2 px grid) with a channel stroke under them.
// Usage: PLAYWRIGHT_CHROMIUM_PATH=... node scripts/runnel-747-measure.mjs [port]
import { chromium } from '@playwright/test'
const port = process.argv[2] ?? '4186'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const page = await b.newPage({ viewport: vp, reducedMotion: 'reduce' })
  await page.goto(`http://localhost:${port}/runnel/?nohelp&sky=noon`)
  await page.waitForTimeout(1200)
  const shot = (await page.screenshot()).toString('base64')
  const r = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode()
    const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, img.width, img.height).data
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const Y = (px, py) => { const i = (Math.round(py) * img.width + Math.round(px)) * 4; return 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]) }
    const L = (y) => 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16
    const steps = [], ratios = []
    for (const cell of document.querySelectorAll('.tiles > g.cell:not(.spring)')) {
      if (cell.querySelector('.field-plot') || cell.classList.contains('wet')) continue
      const lines = [...cell.querySelectorAll('.groove')]
      if (!lines.length || lines.length >= 3) continue
      for (const ln of lines) {
        const m = ln.getScreenCTM(); if (!m) continue
        const a = new DOMPoint(0, 0).matrixTransform(m), e = new DOMPoint(+ln.getAttribute('x2'), +ln.getAttribute('y2')).matrixTransform(m)
        const mx = a.x + (e.x - a.x) * 0.55, my = a.y + (e.y - a.y) * 0.55
        const len = Math.hypot(e.x - a.x, e.y - a.y), nx = -(e.y - a.y) / len, ny = (e.x - a.x) / len
        const half = len * 0.42
        const prof = []
        for (let t = -half; t <= half; t += 0.5) prof.push(L(Y(mx + nx * t, my + ny * t)))
        // smooth over 1.5 px, then count plateaus (runs of 2+ px within 6 L* of the run's start)
        const sm = prof.map((_, i) => { const w = prof.slice(Math.max(0, i - 1), i + 2); return w.reduce((p, q) => p + q, 0) / w.length })
        const plats = []
        let start = sm[0], run = 1
        for (let i = 1; i < sm.length; i++) {
          if (Math.abs(sm[i] - start) <= 6) run++
          else { if (run >= 4) plats.push(start); start = sm[i]; run = 1 }
        }
        if (run >= 4) plats.push(start)
        // merge neighbouring plateaus within 6 L*
        const merged = plats.filter((p, i) => i === 0 || Math.abs(p - plats[i - 1]) > 6)
        steps.push(merged.length)
        const floor = Math.min(...sm), face = (sm[0] + sm[sm.length - 1]) / 2
        const yl = (l) => { const f = (l + 16) / 116; return f ** 3 > 0.008856 ? f ** 3 : (f - 16 / 116) / 7.787 }
        ratios.push((yl(face) + 0.05) / (yl(floor) + 0.05))
      }
    }
    const med = (v) => { const s = [...v].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] }
    // glyph overlap
    let crop = 0, over = 0
    for (const g of document.querySelectorAll('.tiles > g.cell .crop')) {
      const bx = g.getBoundingClientRect()
      for (let yy = bx.top; yy < bx.bottom; yy += 2) for (let xx = bx.left; xx < bx.right; xx += 2) {
        const st = document.elementsFromPoint(xx, yy)
        if (!st.length || !g.contains(st[0])) continue
        crop++
        if (st.some((el) => el.matches('.groove, .groove-bed, .groove-lip, .groove-cut, .bank, .hub-bed, .hub-groove'))) over++
      }
    }
    return { tiles: steps.length, stepsMedian: med(steps), stepsMax: Math.max(...steps), contrastMedian: +med(ratios).toFixed(2), contrastMin: +Math.min(...ratios).toFixed(2), cropPx: crop, cropOverChannel: +(over / Math.max(1, crop) * 100).toFixed(1) }
  }, `data:image/png;base64,${shot}`)
  console.log(n, JSON.stringify(r))
  await page.close()
}
await b.close()
