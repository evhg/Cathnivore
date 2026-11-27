// Plan item 741: Runnel's dry board in numbers, from plan-shots' runnel-D.png and runnel-solved-D.png (1440x900):
// the share of board pixels with L* < 20 (box 470-1330 x 40-830) and the valley's mean chroma (C*ab) in two side
// strips (395-460 and 1340-1405, y 30-640: the valley beside the board in both states, under no dialog).
// Usage: node scripts/runnel-741-measure.mjs <dir>   (decodes in Chromium: no PNG library in the repo)
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const dir = process.argv[2] ?? '.'
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const page = await browser.newPage()
const measure = (b64) => page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode()
  const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d'); x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, img.width, img.height).data
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const lab = (i) => {
    const r = lin(d[i]), g = lin(d[i + 1]), b = lin(d[i + 2])
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
  }
  let dark = 0, n = 0
  for (let y = 40; y < 830; y++) for (let xx = 470; xx < 1330; xx++) { n++; if (lab((y * img.width + xx) * 4)[0] < 20) dark++ }
  let ch = 0, m = 0
  for (const [x0, x1] of [[395, 460], [1340, 1405]]) for (let y = 30; y < 640; y++) for (let xx = x0; xx < x1; xx++) { const [, a, bb] = lab((y * img.width + xx) * 4); ch += Math.hypot(a, bb); m++ }
  return { darkShare: +(dark / n * 100).toFixed(2), valleyChroma: +(ch / m).toFixed(1) }
}, `data:image/png;base64,${b64}`)
for (const f of ['runnel-D.png', 'runnel-solved-D.png']) console.log(f, JSON.stringify(await measure(readFileSync(`${dir}/${f}`).toString('base64'))))
await browser.close()
