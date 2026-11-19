// Plan item 510: the street behind her, measured. For each size and time: the luminance spread (std dev of luma) of
// the critique's boxes right of her (D 1110-1440 x 0-900, P 280-390 x 30-500, L 620-844 x 0-390), with the street layer (render/frontstreet.ts) shown and hidden, and her face's mean
// luma against that region's mean. Needs a dist-site preview on :4180.
//   SIZES="D,1440,900;P,390,844;L,844,390" TS=0,8 node scripts/cathode-510-measure.mjs
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [n, w, h] of (process.env.SIZES ?? 'D,1440,900;P,390,844;L,844,390').split(';').map(s => s.split(','))) {
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage()
  await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto('http://localhost:4180/nightshift/?shot&t=8')
  await p.waitForFunction(() => window.cathodeFront?.scene?.(), null, { timeout: 120000 })
  await p.addStyleTag({ content: 'body *:not(canvas){visibility:hidden!important} canvas{visibility:visible!important}' })
  for (const t of (process.env.TS ?? '0,8').split(',')) {
    const row = {}
    for (const on of [false, true]) {
      const boxes = await p.evaluate(([t, on]) => { const s = window.cathodeFront.scene(); s.world.scene.getObjectByName('front-street').visible = on; s.setTime(+t); return { face: s.faceBox(), fig: s.figureBox(true) } }, [t, on])
      await p.waitForTimeout(1500)
      const png = (await p.screenshot()).toString('base64')
      const m = await p.evaluate(async ({ png, boxes }) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode()
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
        const g = c.getContext('2d'); g.drawImage(img, 0, 0)
        const stat = (x0, y0, x1, y1) => {
          x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); x1 = Math.min(c.width, Math.round(x1)); y1 = Math.min(c.height, Math.round(y1))
          const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data
          let s = 0, s2 = 0, k = 0
          for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += l; s2 += l * l; k++ }
          const mean = s / k
          return { mean: +mean.toFixed(1), sd: +Math.sqrt(s2 / k - mean * mean).toFixed(1) }
        }
        const f = boxes.face, fw = f.right - f.left, fh = f.bottom - f.top
        const R = { 1440: [1110, 0, 1440, 900], 390: [280, 30, 390, 500], 844: [620, 0, 844, 390] }[c.width] ?? [boxes.fig.right, 0, c.width, c.height]
        return { right: stat(...R), face: stat(f.left + fw * 0.2, f.top + fh * 0.2, f.right - fw * 0.2, f.bottom - fh * 0.2) }
      }, { png, boxes })
      row[on ? 'after' : 'before'] = m
    }
    console.log(n, 't=' + t, JSON.stringify(row), 'spread x' + (row.after.right.sd / row.before.right.sd).toFixed(2))
  }
  await p.close()
}
await b.close()
