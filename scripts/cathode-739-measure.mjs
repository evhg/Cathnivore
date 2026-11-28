// Plan item 739: how far apart the class pick's five booking photos are (bookingphoto.ts: stills of the 3D Cath on a
// clear background). Reads each `.cp-mug-photo` image from the page and reports the mean pairwise pixel difference
// (share of pixels whose RGBA moved by more than 48, either photo opaque) and every pair's silhouette difference
// (1 - IoU of the alpha > 128 masks). Saves the photos side by side as <OUT>/mugs-<size>.png.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-739-measure.mjs   (VPS=D,P; OUT=dir)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots/ns739'
mkdirSync(out, { recursive: true })
const VP = { P: [390, 844, 'phone'], D: [1440, 900, 'high'] }
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const s of (process.env.VPS ?? 'D,P').split(',')) {
  const [w, h, q] = VP[s]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: s !== 'D' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const page = await ctx.newPage()
  await page.goto(`${base}?front=classpick&shot&t=8&quality=${q}&class=ghost`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 400_000 })
  await page.waitForFunction(() => document.querySelectorAll('.cp-opt-mug[data-photo="3d"]').length >= 5, null, { timeout: 400_000 })
  const r = await page.evaluate(async () => {
    const seen = new Map()
    for (const m of document.querySelectorAll('.cp-opt-mug[data-photo="3d"]')) if (!seen.has(m.dataset.cls)) seen.set(m.dataset.cls, m.querySelector('img').src)
    const data = []
    for (const [cls, src] of seen) {
      const i = new Image(); i.src = src; await i.decode()
      const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext('2d'); x.drawImage(i, 0, 0)
      data.push({ cls, w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data })
    }
    const pairs = []
    let diffSum = 0
    for (let a = 0; a < data.length; a++) for (let b = a + 1; b < data.length; b++) {
      const A = data[a].d, B = data[b].d
      let moved = 0, n = 0, inter = 0, uni = 0
      for (let k = 0; k < A.length; k += 4) {
        const ma = A[k + 3] > 128, mb = B[k + 3] > 128
        if (ma || mb) { n++; if (Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2]), Math.abs(A[k + 3] - B[k + 3])) > 48) moved++ }
        if (ma && mb) inter++
        if (ma || mb) uni++
      }
      const diff = moved / n
      diffSum += diff
      pairs.push({ pair: `${data[a].cls}/${data[b].cls}`, diff: +(diff * 100).toFixed(1), silhouette: +((1 - inter / uni) * 100).toFixed(1) })
    }
    // the five side by side for a look
    const W = data[0].w, H = data[0].h
    const c = new OffscreenCanvas(W * data.length, H); const x = c.getContext('2d')
    x.fillStyle = '#2a2a2a'; x.fillRect(0, 0, c.width, c.height)
    data.forEach((e, i) => { const im = new ImageData(new Uint8ClampedArray(e.d), e.w, e.h); const t = new OffscreenCanvas(e.w, e.h); t.getContext('2d').putImageData(im, 0, 0); x.drawImage(t, i * W, 0) })
    const blob = await c.convertToBlob({ type: 'image/png' })
    const strip = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob) })
    return { size: `${W}x${H}`, meanDiff: +(diffSum / pairs.length * 100).toFixed(1), minSilhouette: Math.min(...pairs.map((p) => p.silhouette)), pairs, strip }
  })
  writeFileSync(`${out}/mugs-${s}.png`, Buffer.from(r.strip, 'base64'))
  delete r.strip
  console.log(s, JSON.stringify(r))
  await ctx.close()
}
await browser.close()
