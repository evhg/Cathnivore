// Plan item 235: the figure-region pixel difference (x 460-940 at 1440x900, share of pixels whose RGB moved by more
// than 48) between every pair of classes' D class-pick shots from cathode-classpick-shots.mjs.
//   node scripts/cathode-classpick-diff.mjs <dir> <tag>
// REGION=x0,x1 picks another column band. Plan item 338: MASK=x0,x1 (default off) skips that column band (her figure), so what's left is the stage alone:
// the share of the region outside her band that changed.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const [dir, tag] = process.argv.slice(2)
const cls = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']
const [rx0, rx1] = (process.env.REGION ?? '460,940').split(',').map(Number)
const mask = (process.env.MASK ?? '').split(',').filter(Boolean).map(Number)
const urls = cls.map((c) => 'data:image/png;base64,' + readFileSync(`${dir}/${tag}-D-${c}.png`).toString('base64'))
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage()
const r = await p.evaluate(async ([urls, mask, rx0, rx1]) => {
  const data = []
  for (const u of urls) {
    const im = new Image(); im.src = u; await im.decode()
    const c = document.createElement('canvas'); c.width = rx1 - rx0; c.height = 900
    const x = c.getContext('2d'); x.drawImage(im, -rx0, 0) // the region, by default the figure's x 460-940
    data.push(x.getImageData(0, 0, rx1 - rx0, 900).data)
  }
  const out = []
  for (let i = 0; i < data.length; i++) for (let j = i + 1; j < data.length; j++) {
    let n = 0, t = 0
    for (let k = 0; k < data[i].length; k += 4) { const px = rx0 + ((k / 4) % (rx1 - rx0)); if (mask.length === 2 && px >= mask[0] && px < mask[1]) continue; t++; const d = Math.abs(data[i][k]-data[j][k]) + Math.abs(data[i][k+1]-data[j][k+1]) + Math.abs(data[i][k+2]-data[j][k+2]); if (d > 48) n++ }
    out.push([i, j, +(100 * n / t).toFixed(1)])
  }
  return out
}, [urls, mask, rx0, rx1])
for (const [i, j, v] of r) console.log(cls[i], cls[j], v + '%')
await b.close()
