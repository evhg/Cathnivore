// Plan item 735: Hedgerow's 3D view at P (390x844) and D for LEVELS (default 1,12,27,34): the fitted field's share,
// each depot's projected box and how much of it the canvas holds, and a shot into OUT.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then this.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/h735'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const level of (process.env.LEVELS ?? '1,12,27,34').split(',').map(Number))
  for (const [n, vp] of (process.env.SIZES ?? 'P').split(',').map((k) => [k, k === 'P' ? { width: 390, height: 844 } : { width: 1440, height: 900 }])) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: n === 'P', isMobile: n === 'P' })
    const p = await ctx.newPage()
    await p.goto('http://localhost:4186/hedgerow/?sandbox=1')
    await p.evaluate((l) => {
      const stars = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await p.goto(`http://localhost:4186/hedgerow/?sandbox=1&level=${level}`)
    await p.waitForFunction(() => !!window.hedgerow?.game() && window.hedgerow.fieldShare() !== null, null, { timeout: 90_000 })
    for (let i = 0; i < 40 && !(await p.evaluate(() => window.hedgerow.camSettled())); i++) await p.waitForTimeout(500)
    await p.waitForTimeout(2000)
    const m = await p.evaluate(() => {
      const c = document.querySelector('#canvas').getBoundingClientRect()
      return { canvas: [Math.round(c.width), Math.round(c.height)], share: window.hedgerow.fieldShare(), depots: window.hedgerow.depotFrames(), fog: window.hedgerow.fogFrame() }
    })
    console.log(tag, level, n, JSON.stringify(m))
    const png = await p.screenshot({ path: `${out}/${tag}-l${level}-${n}.png`, timeout: 120_000 })
    // Mean luminance (sRGB-decoded, Rec. 709) and saturation over the canvas's middle (25-75% wide, 30-80% high).
    const lum = await p.evaluate(async (b64) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const cv = new OffscreenCanvas(img.width, img.height)
      const x = cv.getContext('2d')
      x.drawImage(img, 0, 0)
      const c = document.querySelector('#canvas').getBoundingClientRect()
      const k = img.width / innerWidth
      const x0 = Math.round((c.x + c.width * 0.25) * k), w = Math.round(c.width * 0.5 * k)
      const y0 = Math.round((c.y + c.height * 0.3) * k), h = Math.round(c.height * 0.5 * k)
      const d = x.getImageData(x0, y0, w, h).data
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      let L = 0, S = 0, n = 0
      for (let i = 0; i < d.length; i += 4) {
        L += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
        S += mx ? (mx - mn) / mx : 0
        n++
      }
      return { lum: Math.round((L / n) * 1000) / 1000, sat: Math.round((S / n) * 1000) / 1000 }
    }, png.toString('base64'))
    console.log(tag, level, n, 'lum', JSON.stringify(lum))
    // The same over the plots alone: a 7x7 px patch at each empty plot's centre (off the lanes), so P and D compare
    // like with like whatever the framing puts in the middle.
    const plots = await p.evaluate(async (b64) => {
      const h = window.hedgerow, g = h.game(), lv = g.level
      const road = new Set([...lv.path, ...(lv.path2 ?? [])].map(([c, r]) => `${c},${r}`))
      const busy = new Set(g.towers.map((t) => `${t.col},${t.row}`))
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const cv = new OffscreenCanvas(img.width, img.height)
      const x = cv.getContext('2d')
      x.drawImage(img, 0, 0)
      const k = img.width / innerWidth
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      let L = 0, S = 0, n = 0
      for (let r = 0; r < lv.rows; r++)
        for (let c = 0; c < lv.cols; c++) {
          if (road.has(`${c},${r}`) || busy.has(`${c},${r}`)) continue
          const q = h.cellCenter(c, r)
          if (!q || document.elementFromPoint(q.x, q.y)?.id !== 'canvas') continue
          const px = Math.round(q.x * k), py = Math.round(q.y * k)
          if (px < 4 || py < 4 || px > img.width - 4 || py > img.height - 4) continue
          const d = x.getImageData(px - 3, py - 3, 7, 7).data
          for (let i = 0; i < d.length; i += 4) {
            L += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
            const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
            S += mx ? (mx - mn) / mx : 0
            n++
          }
        }
      return { lum: Math.round((L / n) * 1000) / 1000, sat: Math.round((S / n) * 1000) / 1000, px: n }
    }, png.toString('base64'))
    console.log(tag, level, n, 'plots', JSON.stringify(plots))
    await ctx.close()
  }
await b.close()
