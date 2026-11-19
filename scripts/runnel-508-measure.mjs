// Plan item 508: Runnel's valley in poster colour. With the valley at full colour (the solved board, `?shotsolve`),
// the mean OKLCH chroma of the valley's pixels away from the tiles, and the share of them in each 30 deg hue bin
// (pixels with chroma 0.03+). Needs a dist-site preview (BASE, default :4180).
// Usage: node scripts/runnel-508-measure.mjs   (OUT=<dir> also saves the frames)
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const p = await b.newPage({ viewport: vp })
  await p.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results: {}, bestPractice: {}, practiceSolved: 3, seenHelp: true })))
  await p.emulateMedia({ reducedMotion: 'reduce' })
  await p.goto(`${base}/runnel/?shotsolve&nohelp`); await p.waitForTimeout(1500)
  // the last tap waters the board, and the valley greens to full colour (the win card is then closed for the frame)
  await p.locator('[data-last]').first().click(); await p.waitForTimeout(2500)
  await p.keyboard.press('Escape'); await p.waitForTimeout(800)
  const png = await p.screenshot()
  if (out) await p.screenshot({ path: `${out}/runnel-solved-${name}.png` })
  const r = await p.evaluate(async (b64) => {
    const tiles = [...document.querySelectorAll('.board .tile')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 20)
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data
    const v = document.querySelector('.valley, .stage').getBoundingClientRect()
    const near = (x, y) => tiles.some((t) => x > t.left - 10 && x < t.right + 10 && y > t.top - 10 && y < t.bottom + 10)
    const lin = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4 }
    const lch = (i) => {
      const r = lin(d[i]), gg = lin(d[i + 1]), bb = lin(d[i + 2])
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gg + 0.0514459929 * bb)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gg + 0.1073969566 * bb)
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * gg + 0.6299787005 * bb)
      const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
      return [Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360]
    }
    let sum = 0, n = 0
    const bins = new Array(12).fill(0)
    for (let y = v.top + 3; y < v.bottom - 3; y += 3) for (let x = v.left + 3; x < v.right - 3; x += 3) {
      if (near(x, y)) continue
      const [C, h] = lch(((y | 0) * c.width + (x | 0)) * 4)
      sum += C; n++
      if (C >= 0.03) bins[Math.floor(h / 30)]++
    }
    const share = bins.map((k) => +(k / n * 100).toFixed(1))
    return { chroma: +(sum / n).toFixed(4), bins3: share.filter((s) => s >= 3).length, share }
  }, png.toString('base64'))
  console.log(name, JSON.stringify(r))
  await p.close()
}
await b.close()
