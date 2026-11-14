// Plan item 388: the Hedgerow 2D margins against the field at D (1440x900, ?2d), levels 21 and 34. For each box (x
// ranges, the board's height) it reports mean saturation (HSL), global contrast (luminance standard deviation) and
// local contrast (the mean standard deviation in 24 px windows), and each margin's difference from its field.
// Usage: npx vite preview --outDir dist-site --port 4190 &  then  TAG=before node scripts/hedgerow-388-measure.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4190'
const out = process.env.OUT ?? 'e2e/screenshots/hedgerow388'
const tag = process.env.TAG ?? 'after'
mkdirSync(out, { recursive: true })
const LEVELS = { 21: { field: [420, 790], margins: { sea: [830, 1070] } }, 34: { field: [160, 520], margins: { river: [870, 1080], meadow: [10, 110] } } }
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const result = {}
for (const [level, boxes] of Object.entries(LEVELS)) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(`${base}/hedgerow/?sandbox=1&2d`)
  await p.evaluate(([s, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })), [stars(level - 1), level])
  await p.goto(`${base}/hedgerow/?sandbox=1&2d&level=${level}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await p.waitForTimeout(1200)
  const png = await p.screenshot({ path: `${out}/D-l${level}-${tag}.png` })
  const cv = await p.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] })
  result[`l${level}`] = await p.evaluate(async ({ src, boxes, cv }) => {
    const img = new Image(); img.src = src; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const stats = ([x0, x1]) => {
      const y0 = Math.max(cv[0], 0) + 10, y1 = Math.min(cv[1], img.height) - 10
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data, w = x1 - x0, h = y1 - y0
      const L = new Float32Array(w * h); let sat = 0
      for (let i = 0; i < w * h; i++) {
        const r = d[i * 4] / 255, gg = d[i * 4 + 1] / 255, bb = d[i * 4 + 2] / 255
        const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), l = (mx + mn) / 2
        sat += mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1))
        L[i] = 0.2126 * r + 0.7152 * gg + 0.0722 * bb
      }
      const sd = (xs) => { const m = xs.reduce((a, v) => a + v, 0) / xs.length; return Math.sqrt(xs.reduce((a, v) => a + (v - m) ** 2, 0) / xs.length) }
      let loc = 0, n = 0
      for (let y = 0; y + 24 <= h; y += 24) for (let x = 0; x + 24 <= w; x += 24) {
        const xs = []; for (let j = 0; j < 24; j++) for (let k = 0; k < 24; k++) xs.push(L[(y + j) * w + x + k]); loc += sd(xs); n++
      }
      return { sat: +(sat / (w * h)).toFixed(3), global: +sd(Array.from(L)).toFixed(3), local: +(loc / n).toFixed(3) }
    }
    const f = stats(boxes.field)
    const out = { field: f }
    for (const [k, box] of Object.entries(boxes.margins)) {
      const m = stats(box)
      out[k] = { ...m, dSat: +((m.sat / f.sat - 1) * 100).toFixed(0), dGlobal: +((m.global / f.global - 1) * 100).toFixed(0), dLocal: +((m.local / f.local - 1) * 100).toFixed(0) }
    }
    return out
  }, { src: `data:image/png;base64,${png.toString('base64')}`, boxes, cv })
  await p.close()
}
console.log(JSON.stringify(result))
await b.close()
