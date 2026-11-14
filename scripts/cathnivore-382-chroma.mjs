// Plan item 382: mean chroma (max-min of RGB, 0-255) of a shot's regions, decoded in the browser.
//   node scripts/cathnivore-382-chroma.mjs <png> x,y,w,h [x,y,w,h ...]
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const [file, ...rects] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const p = await b.newPage()
const url = 'data:image/png;base64,' + readFileSync(file).toString('base64')
const out = await p.evaluate(async ([url, rects]) => {
  const img = new Image(); img.src = url; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  return rects.map((r) => {
    const [x, y, w, h] = r.split(',').map(Number)
    const d = g.getImageData(x, y, w, h).data
    let s = 0
    for (let i = 0; i < d.length; i += 4) s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])
    return `${r}: ${(s / (d.length / 4)).toFixed(1)}`
  })
}, [url, rects])
console.log(file.split('/').pop(), out.join('  '))
await b.close()
