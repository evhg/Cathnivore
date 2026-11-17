// Plan item 457: the class pick's dominant hue per class (saturation-weighted circular mean over the stage, P 0-390 x
// 70-400, D 480-960 x 60-850) from cathode-classpick-shots.mjs's PNGs, and the smallest gap between any two classes.
//   node scripts/cathode-sethue.mjs <shots dir> <tag>
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const [dir, tag] = process.argv.slice(2)
const R = { P: [0, 70, 390, 400], D: [480, 60, 960, 850] }
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage()
const out = {}
for (const s of ['P', 'D']) for (const c of ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']) {
  let buf; try { buf = readFileSync(`${dir}/${tag}-${s}-${c}.png`) } catch { continue }
  const url = 'data:image/png;base64,' + buf.toString('base64')
  out[`${s}-${c}`] = await p.evaluate(async ([url, r]) => {
    const im = new Image(); im.src = url; await im.decode()
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0)
    const d = g.getImageData(r[0], r[1], r[2] - r[0], r[3] - r[1]).data
    let x = 0, y = 0, n = 0
    for (let i = 0; i < d.length; i += 16) {
      const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), c = mx - mn
      if (mx < 0.06 || c < 0.05) continue
      let h = mx === R ? ((G - B) / c) % 6 : mx === G ? (B - R) / c + 2 : (R - G) / c + 4
      h *= 60
      const w = c
      x += Math.cos(h * Math.PI / 180) * w; y += Math.sin(h * Math.PI / 180) * w; n += w
    }
    return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360)
  }, [url, R[s]])
}
console.log(JSON.stringify(out))
for (const s of ['P', 'D']) { const ks = Object.keys(out).filter((k) => k.startsWith(s)); let m = 360
  for (const a of ks) for (const bb of ks) if (a < bb) { const d = Math.abs(out[a] - out[bb]); m = Math.min(m, Math.min(d, 360 - d)) }
  console.log(s, 'min pairwise hue gap', m) }
await b.close()
