// Plan item 363: the title coat's 8 px edge band against the street just outside it, measured on a live frame.
// Shoots /nightshift/?shot&front=title&t=8, hides Cath and redraws for a mask (the pixels that changed), keeps the
// coat's rows (shoulder to hem), and compares mean linear luminance 8 CSS px inside her silhouette with 8 px outside,
// left and right halves apart (the window under the UI is the same in both shots, so it never enters the mask).
//   SITE_URL=http://localhost:4186 node scripts/cathode-coatband.mjs [P|D] [out-dir]
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const size = (process.argv[2] ?? 'D') === 'P' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
const out = process.argv[3]
const base = process.env.SITE_URL ?? 'http://localhost:4186'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: size, deviceScaleFactor: 1 })
await p.goto(base + '/nightshift/?shot')
await p.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
await p.goto(base + '/nightshift/?shot&front=title&t=8')
await p.waitForFunction(() => window.cathodeFront?.ready && window.cathodeFront.scene()?.stats?.frames >= 1, null, { timeout: 240_000 })
await p.evaluate(() => { const f = document.getElementById('front-fallback'); if (f) f.style.opacity = '0' })
const frames = () => p.evaluate(() => window.cathodeFront.scene().stats.frames)
const redraw = async () => {
  const f0 = await frames()
  await p.evaluate(() => window.cathodeFront.scene().setTime(8))
  await p.waitForFunction((f) => window.cathodeFront.scene().stats.frames > f, f0, { timeout: 240_000 })
  await p.waitForTimeout(500)
}
await redraw()
const withHer = await p.screenshot()
// Hiding her reframes the title camera (it frames her), so the mask is her drawn flat white in the same framing.
await p.evaluate(() => {
  const g = window.cathodeFront.scene().cath.group
  window.__mats = []
  g.traverse((o) => { if (o.isMesh) { window.__mats.push([o, o.material]); const m = o.material.clone(); m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => 'mask'; m.color?.set(0x000000); m.emissive?.set(0x00ff00); m.emissiveIntensity = 0.6; m.map = null; m.emissiveMap = null; m.vertexColors = false; m.roughness = 1; m.metalness = 0; m.clearcoat = 0; m.sheen = 0; m.envMapIntensity = 0; m.needsUpdate = true; o.material = m } })
})
await redraw()
const without = await p.screenshot()
await p.evaluate(() => { for (const [o, m] of window.__mats) o.material = m })
if (out) { writeFileSync(out + '/band-with.png', withHer); writeFileSync(out + '/band-without.png', without) }
const r = await p.evaluate(async ([a, c]) => {
  const load = async (u) => { const i = new Image(); i.src = 'data:image/png;base64,' + u; await i.decode(); const cv = new OffscreenCanvas(i.width, i.height); const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return { W: i.width, H: i.height, d: g.getImageData(0, 0, i.width, i.height).data } }
  const A = await load(a), C = await load(c)
  const { W, H } = A
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const Y = (d, i) => 0.2126 * lin(d[i] / 255) + 0.7152 * lin(d[i + 1] / 255) + 0.0722 * lin(d[i + 2] / 255)
  let m = new Uint8Array(W * H)
  for (let k = 0; k < W * H; k++) { const i = k * 4; m[k] = Math.abs(A.d[i] - C.d[i]) + Math.abs(A.d[i + 1] - C.d[i + 1]) + Math.abs(A.d[i + 2] - C.d[i + 2]) > 24 && C.d[i + 1] > 90 && C.d[i + 1] > 1.6 * C.d[i] && C.d[i + 1] > 1.6 * C.d[i + 2] ? 1 : 0 }
  // Close (dilate then erode, 3 px) to drop rain specks and fill her.
  const morph = (src, dil, r) => { const o = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = dil ? 0 : 1; for (let dy = -r; dy <= r && (dil ? !v : v); dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : src[yy * W + xx]; if (dil && s) { v = 1; break } if (!dil && !s) { v = 0; break } } o[y * W + x] = v } return o }
  m = morph(morph(morph(m, false, 2), true, 2), true, 2); m = morph(m, false, 2)
  // Keep her component only (the clinic card's green is not her): flood from the widest run in the lower half.
  let seed = -1, best = 0
  for (let y = Math.round(H * 0.6); y < H * 0.9; y++) { let run = 0; for (let x = 0; x < W; x++) { run = m[y * W + x] ? run + 1 : 0; if (run > best) { best = run; seed = y * W + x } } }
  const keep = new Uint8Array(W * H); const st = [seed]; keep[seed] = 1
  while (st.length) { const k = st.pop(); const x = k % W; for (const n of [k - 1, k + 1, k - W, k + W]) if (n >= 0 && n < W * H && !keep[n] && m[n] && Math.abs((n % W) - x) <= 1) { keep[n] = 1; st.push(n) } }
  m = keep
  let top = H, bot = 0
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) n += m[y * W + x]; if (n > 2) { top = Math.min(top, y); bot = y } }
  // Chest to hem (the umbrella is in her box, so the coat starts under half way).
  const y0 = Math.round(top + 0.45 * (bot - top)), y1 = Math.round(bot - 0.03 * (bot - top))
  // The coat's rows only: below its hem her legs are a narrow run (boots against the kerb, not the coat).
  let wmax = 0
  for (let y = y0; y < y1; y++) { let l = -1, r = -1; for (let x = 0; x < W; x++) if (m[y * W + x]) { if (l < 0) l = x; r = x } wmax = Math.max(wmax, r - l) }
  const side = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] }
  for (let y = y0; y < y1; y++) {
    let l = -1, r = -1
    for (let x = 0; x < W; x++) if (m[y * W + x]) { if (l < 0) l = x; r = x }
    if (l < 0 || r - l < 0.45 * wmax) continue
    for (let k = 0; k < 8; k++) {
      if (l - 1 - k >= 0) { side.L[2] += Y(A.d, (y * W + l - 1 - k) * 4); side.L[3]++ }
      side.L[0] += Y(A.d, (y * W + l + 2 + k) * 4); side.L[1]++
      if (r + 1 + k < W) { side.R[2] += Y(A.d, (y * W + r + 1 + k) * 4); side.R[3]++ }
      side.R[0] += Y(A.d, (y * W + r - 2 - k) * 4); side.R[1]++
    }
  }
  const f = (s) => ({ inside: +(s[0] / s[1]).toFixed(4), outside: +(s[2] / s[3]).toFixed(4), ratio: +((s[0] / s[1]) / (s[2] / s[3])).toFixed(2) })
  return { box: [top, bot], rows: [y0, y1], L: f(side.L), R: f(side.R) }
}, [withHer.toString('base64'), without.toString('base64')])
console.log(JSON.stringify(r))
await b.close()
