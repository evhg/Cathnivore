// Plan item 283: how much of a NIGHT SHIFT title shot is a void. Slides a 200x200 CSS px window (10 px steps) over
// each PNG and reports the windows whose mean lightness (CIE L*, 0-100) is under 3, and the darkest four.
//   node scripts/cathode-title-dark.mjs shot-D.png [more.png]   (DPR from the width: 1440 or 390 CSS px wide)
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage()
for (const f of process.argv.slice(2)) {
  const url = 'data:image/png;base64,' + readFileSync(f).toString('base64')
  const r = await p.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const W = img.width, H = img.height
    const css = W >= 1000 ? W / 1440 : W / 390
    const c = new OffscreenCanvas(W, H)
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, W, H).data
    const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    const ii = new Float64Array((W + 1) * (H + 1))
    for (let y = 0; y < H; y++) {
      let row = 0
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        const Y = 0.2126 * lin(d[i] / 255) + 0.7152 * lin(d[i + 1] / 255) + 0.0722 * lin(d[i + 2] / 255)
        row += Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y
        ii[(y + 1) * (W + 1) + x + 1] = ii[y * (W + 1) + x + 1] + row
      }
    }
    const w = Math.round(200 * css), st = Math.round(10 * css)
    const out = []
    for (let y = 0; y + w <= H; y += st)
      for (let x = 0; x + w <= W; x += st) {
        const s = ii[(y + w) * (W + 1) + x + w] - ii[y * (W + 1) + x + w] - ii[(y + w) * (W + 1) + x] + ii[y * (W + 1) + x]
        out.push([s / (w * w), Math.round(x / css), Math.round(y / css)])
      }
    out.sort((a, b) => a[0] - b[0])
    return { under3: out.filter((o) => o[0] < 3).length, of: out.length, darkest: out.slice(0, 4).map((o) => [+o[0].toFixed(2), o[1], o[2]]) }
  }, url)
  console.log(f.split('/').pop(), JSON.stringify(r))
}
await b.close()
