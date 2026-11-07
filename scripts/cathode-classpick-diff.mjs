// Plan item 235: the figure-region pixel difference (x 460-940 at 1440x900, share of pixels whose RGB moved by more
// than 48) between every pair of classes' D class-pick shots from cathode-classpick-shots.mjs.
//   node scripts/cathode-classpick-diff.mjs <dir> <tag>
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const [dir, tag] = process.argv.slice(2)
const cls = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']
const urls = cls.map((c) => 'data:image/png;base64,' + readFileSync(`${dir}/${tag}-D-${c}.png`).toString('base64'))
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage()
const r = await p.evaluate(async (urls) => {
  const data = []
  for (const u of urls) {
    const im = new Image(); im.src = u; await im.decode()
    const c = document.createElement('canvas'); c.width = 480; c.height = 900
    const x = c.getContext('2d'); x.drawImage(im, -460, 0) // figure region x 460-940
    data.push(x.getImageData(0, 0, 480, 900).data)
  }
  const out = []
  for (let i = 0; i < data.length; i++) for (let j = i + 1; j < data.length; j++) {
    let n = 0, t = 0
    for (let k = 0; k < data[i].length; k += 4) { t++; const d = Math.abs(data[i][k]-data[j][k]) + Math.abs(data[i][k+1]-data[j][k+1]) + Math.abs(data[i][k+2]-data[j][k+2]); if (d > 48) n++ }
    out.push([i, j, +(100 * n / t).toFixed(1)])
  }
  return out
}, urls)
for (const [i, j, v] of r) console.log(cls[i], cls[j], v + '%')
await b.close()
