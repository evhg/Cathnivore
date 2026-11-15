// Plan item 427: the title coat as cloth, measured on a live frame. Same mask as cathode-coatband.mjs (her meshes
// drawn flat green in the same framing); inside the coat (eroded 3 px, chest to hem rows at 45% width or more) it
// reports the luminance (sRGB luma, 0-255) standard deviation and median, and the share of the shoulder band's pixels
// (the top 12% of the coat's rows) at 25% or more over the coat's median, and texSd, the SD of luma minus its 9 px
// box mean (the cloth's detail apart from its lighting). Only the wool meshes are masked.
//   SITE_URL=http://localhost:4186 node scripts/cathode-coatcloth.mjs [P|D] [out-dir]
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
  g.traverse((o) => { if (o.isMesh) { window.__mats.push([o, o.material]); const k = o.material.customProgramCacheKey?.() ?? ''; const wool = k.includes('wool') || k === 'front-rim-skirt'; const m = o.material.clone(); m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => 'mask'; m.color?.set(0x000000); m.emissive?.set(wool ? 0x00ff00 : 0x000000); m.emissiveIntensity = 0.6; m.map = null; m.emissiveMap = null; m.vertexColors = false; m.roughness = 1; m.metalness = 0; m.clearcoat = 0; m.sheen = 0; m.envMapIntensity = 0; m.needsUpdate = true; o.material = m } })
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
  // The belt splits the coat in two: keep every masked pixel inside the seed component's columns (the clinic card
  // at the frame's edge stays out).
  let kx0 = W, kx1 = 0
  for (let k = 0; k < W * H; k++) if (keep[k]) { const x = k % W; kx0 = Math.min(kx0, x); kx1 = Math.max(kx1, x) }
  for (let k = 0; k < W * H; k++) { const x = k % W; if (m[k] && (x < kx0 - 4 || x > kx1 + 4)) m[k] = 0 }
  let top = H, bot = 0
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) n += m[y * W + x]; if (n > 2) { top = Math.min(top, y); bot = y } }
  const inner = morph(m, false, 3)
  const luma = (i) => 0.2126 * A.d[i] + 0.7152 * A.d[i + 1] + 0.0722 * A.d[i + 2]
  const span = (y) => { let l = -1, r = -1; for (let x = 0; x < W; x++) if (m[y * W + x]) { if (l < 0) l = x; r = x } return [l, r] }
  const y0 = top, y1 = bot
  const coat = []
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) if (inner[y * W + x]) coat.push(luma((y * W + x) * 4))
  const mean = coat.reduce((a, b) => a + b, 0) / coat.length
  const sd = Math.sqrt(coat.reduce((a, b) => a + (b - mean) ** 2, 0) / coat.length)
  const med = [...coat].sort((a, b) => a - b)[coat.length >> 1]
  const s0 = top, s1 = Math.round(top + 0.12 * (bot - top))
  let sh = 0, shHot = 0
  for (let y = s0; y < s1; y++) for (let x = 0; x < W; x++) if (inner[y * W + x]) { sh++; if (luma((y * W + x) * 4) >= med * 1.25) shHot++ }
  // The cloth's own texture apart from its lighting: luma minus a 9 px box mean, inside the coat.
  const R = 4
  let hp = 0, hn = 0
  for (let y = y0 + R; y < y1 - R; y++) for (let x = R; x < W - R; x++) {
    if (!inner[y * W + x]) continue
    let sum = 0
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) sum += luma(((y + dy) * W + x + dx) * 4)
    const d = luma((y * W + x) * 4) - sum / (2 * R + 1) ** 2
    hp += d * d; hn++
  }
  const texSd = Math.sqrt(hp / Math.max(1, hn))
  return { texSd: +texSd.toFixed(2), box: [top, bot], rows: [y0, y1], n: coat.length, mean: +mean.toFixed(1), sd: +sd.toFixed(2), median: +med.toFixed(1), shoulder: [s0, s1], shoulderHot: +(shHot / Math.max(1, sh)).toFixed(3) }
}, [withHer.toString('base64'), without.toString('base64')])
console.log(JSON.stringify(r))
await b.close()
