// Plan item 499: Runnel desktop: how much of the frame the board's tiles cover, and the valley's saturation
// against the tiles'. Needs a dist-site preview (BASE, default :4180). Usage: node scripts/runnel-499-measure.mjs
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, q] of [['lesson', ''], ['daily', '?shotsolve']]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  if (name === 'daily') await p.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, lessonDone: true, results: {} })))
  await p.goto(`${base}/runnel/${q}`); await p.waitForTimeout(2500)
  const png = await p.screenshot()
  if (out) await p.screenshot({ path: `${out}/runnel-${name}-D.png` })
  const r = await p.evaluate(async (b64) => {
    const tiles = [...document.querySelectorAll('.board .tile')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 20)
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data
    const stage = document.querySelector('.stage').getBoundingClientRect()
    const inTile = (x, y) => tiles.some((t) => x > t.left + t.width * .2 && x < t.right - t.width * .2 && y > t.top + t.height * .2 && y < t.bottom - t.height * .2)
    const nearTile = (x, y) => tiles.some((t) => x > t.left - 10 && x < t.right + 10 && y > t.top - 10 && y < t.bottom + 10)
    const sat = (i) => { const r = d[i] / 255, gg = d[i + 1] / 255, bb = d[i + 2] / 255; const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb); return mx === 0 ? 0 : (mx - mn) / mx }
    let st = 0, nt = 0, sb = 0, nb = 0
    for (let y = stage.top + 4; y < stage.bottom - 4; y += 4) for (let x = stage.left + 4; x < stage.right - 4; x += 4) {
      const i = ((y | 0) * c.width + (x | 0)) * 4
      if (inTile(x, y)) { st += sat(i); nt++ } else if (!nearTile(x, y)) { sb += sat(i); nb++ }
    }
    const x0 = Math.min(...tiles.map((t) => t.left)), x1 = Math.max(...tiles.map((t) => t.right)), y0 = Math.min(...tiles.map((t) => t.top)), y1 = Math.max(...tiles.map((t) => t.bottom))
    return { tiles: tiles.length, cover: +((x1 - x0) * (y1 - y0) / innerWidth / innerHeight * 100).toFixed(1), tileSat: +(st / nt).toFixed(3), valleySat: +(sb / nb).toFixed(3) }
  }, png.toString('base64'))
  console.log(name, JSON.stringify(r))
}
await b.close()
