// Plan item 514: her face against the class-pick set. For each class at 1440x900 (`?front=classpick&shot&t=8`), the mean
// luminance of her face (the middle 60% of `scene().faceBox()`) over the set's (two strips beside her figure, x
// 480-600 and 830-960, y 60-780), and the frames the scene drew (a still poster shows 0-1). Bar: 1.3x+. SETTLE (ms, default 8000) waits for
// the pick to ease in: at 3 s her face still read dark (the Wirewitch 0.51x, a settled frame well over).
// Usage: a NIGHT SHIFT preview, then BASE=http://localhost:4175 node scripts/cathode-514-face.mjs
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'http://localhost:4175'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const cls of (process.env.CLS ?? 'ghost,butcher,gunslinger,wirewitch,fixer').split(',')) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(`${base}/nightshift/?shot`)
  await p.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto(`${base}/nightshift/?front=classpick&shot&t=8&class=${cls}&rs=0.5`)
  await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 150000 })
  // the pick eases in (wardrobe, key, coat) for a few seconds under SwiftShader: an early frame reads her face dark
  await p.waitForTimeout(Number(process.env.SETTLE ?? 8000))
  const png = (await p.screenshot({ timeout: 120000 })).toString('base64')
  const r = await p.evaluate(async (b64) => {
    const f = window.cathodeFront.scene().faceBox()
    const frames = window.cathodeFront.scene().stats?.frames ?? null
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const L = (x, y) => { const i = (y * c.width + x) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] }
    const mean = (x0, y0, x1, y1, skip) => { let s = 0, n = 0; for (let y = y0 | 0; y < y1; y += 2) for (let x = x0 | 0; x < x1; x += 2) { if (skip && skip(x, y)) continue; s += L(x, y); n++ } return s / n }
    const fw = f.right - f.left, fh = f.bottom - f.top
    const face = mean(f.left + fw * 0.2, f.top + fh * 0.2, f.right - fw * 0.2, f.bottom - fh * 0.2)
    // the set: two strips beside her figure, above the subtitle (her coat and the line are not the set)
    const set = (mean(480, 60, 600, 780) + mean(830, 60, 960, 780)) / 2
    return { face: Math.round(face), set: Math.round(set), ratio: +(face / set).toFixed(2), frames }
  }, png)
  console.log(cls.padEnd(10), JSON.stringify(r))
  await p.close()
}
await b.close()
