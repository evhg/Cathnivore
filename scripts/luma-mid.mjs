// Mean luminance (0-255, Rec. 709) of each PNG's middle third, decoded in Chromium (no image library in the repo).
// Usage: node scripts/luma-mid.mjs a.png b.png ...
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage()
for (const f of process.argv.slice(2)) {
  const url = `data:image/png;base64,${readFileSync(f).toString('base64')}`
  const v = await p.evaluate(async (u) => {
    const img = new Image()
    img.src = u
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const x0 = Math.floor(img.width / 3), y0 = Math.floor(img.height / 3)
    const d = g.getImageData(x0, y0, x0, y0).data
    let s = 0
    for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    return s / (d.length / 4)
  }, url)
  console.log(f.split('/').pop(), v.toFixed(2))
}
await b.close()
