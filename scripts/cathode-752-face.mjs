// Plan item 752: Cath's face on the title poster (games/cathode/public/front-poster-1440.webp, 1440 wide): the
// luminance spread over the face box (p95 - p5 of L*, and the standard deviation), the near-white clusters (L* > 88)
// in each eye box, and the cheek's a* against the forehead's. Decoded in Chromium (no PIL here). Saves the face box 4x.
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-752-face.mjs [poster] [face=x0,y0,x1,y1] [out.png]
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const file = process.argv[2] ?? 'games/cathode/public/front-poster-1440.webp'
const face = (process.argv[3] ?? '960,285,1065,375').split(',').map(Number)
const out = process.argv[4] ?? 'e2e/screenshots/ns752/face.png'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage()
const src = `data:image/webp;base64,${readFileSync(file).toString('base64')}`
const r = await p.evaluate(async ({ src, face }) => {
  const img = new Image(); img.src = src; await img.decode()
  const [x0, y0, x1, y1] = face, w = x1 - x0, h = y1 - y0
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d'); g.drawImage(img, -x0, -y0)
  const d = g.getImageData(0, 0, w, h).data
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const L = new Float32Array(w * h), A = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const R = lin(d[i * 4]), G = lin(d[i * 4 + 1]), B = lin(d[i * 4 + 2])
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089
    L[i] = 116 * f(Y) - 16; A[i] = 500 * (f(X) - f(Y))
  }
  const s = [...L].sort((a, b) => a - b), q = (k) => s[Math.floor(k * (s.length - 1))]
  const mean = s.reduce((a, v) => a + v, 0) / s.length
  const sd = Math.sqrt(s.reduce((a, v) => a + (v - mean) ** 2, 0) / s.length)
  // near-white clusters: 4-connected groups of L* > 88 pixels
  const seen = new Uint8Array(w * h); const clusters = []
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || L[i] <= 88) continue
    const st = [i]; seen[i] = 1; let n = 0, sx = 0, sy = 0
    while (st.length) { const j = st.pop(); n++; sx += j % w; sy += Math.floor(j / w); for (const k of [j - 1, j + 1, j - w, j + w]) if (k >= 0 && k < w * h && !seen[k] && L[k] > 88 && Math.abs((k % w) - (j % w)) <= 1) { seen[k] = 1; st.push(k) } }
    clusters.push([Math.round(x0 + sx / n), Math.round(y0 + sy / n), n])
  }
  const z = document.createElement('canvas'); z.width = w * 4; z.height = h * 4
  const zg = z.getContext('2d'); zg.imageSmoothingEnabled = false; zg.drawImage(c, 0, 0, w * 4, h * 4)
  const meanA = A.reduce((a, v) => a + v, 0) / A.length
  return { meanA: +meanA.toFixed(1), spread: +(q(0.95) - q(0.05)).toFixed(1), sd: +sd.toFixed(1), meanL: +mean.toFixed(1), clusters, png: z.toDataURL('image/png').split(',')[1] }
}, { src, face })
writeFileSync(out, Buffer.from(r.png, 'base64')); delete r.png
console.log(JSON.stringify(r))
await b.close()
