import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage()
const src = 'data:image/webp;base64,' + readFileSync(process.argv[2]).toString('base64')
const r = await p.evaluate(async ({ src, boxes }) => {
  const im = new Image(); im.src = src; await im.decode()
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
  const g = c.getContext('2d'); g.drawImage(im, 0, 0)
  const lin = (v) => (v / 255) ** 2.2
  return Object.fromEntries(Object.entries(boxes).map(([k, [x, y, x2, y2]]) => {
    const d = g.getImageData(x, y, x2 - x, y2 - y).data; let s = 0, hi = 0, n = 0
    for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); s += l; if (l > 0.9) hi++; n++ }
    return [k, { mean: +(s / n).toFixed(3), hi: +(hi / n).toFixed(3) }]
  }))
}, { src, boxes: JSON.parse(process.argv[3]) })
console.log(JSON.stringify(r)); await b.close()
