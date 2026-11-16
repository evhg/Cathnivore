// Plan item 434: each class's rendered coat colour at D on the pick, and CIE76 dE between every pair. Her coat's
// materials (FrontCath.coatMats) are drawn flat green for a mask; the colour is the plain frame's mean under it
// (pixels whose 2 px neighbours are all in the mask). Needs a dist-site preview (SITE_URL, default :4186).
//   SITE_URL=http://localhost:4186 PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-coatcolour.mjs [shot-dir]
import { chromium } from '@playwright/test'
const base = process.env.SITE_URL ?? 'http://localhost:4186'
const dir = process.argv[2]
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await p.goto(base + '/nightshift/?shot')
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })) })
await p.goto(base + '/nightshift/?play&rs=0.5')
await p.waitForFunction(() => window.cathodeFront?.scene()?.dressed === 'ghost', null, { timeout: 200000 })
const out = {}
const masks = {}
const greenCount = async (p, png) => p.evaluate(async (c) => {
  const i = new Image(); i.src = 'data:image/png;base64,' + c; await i.decode(); const cv = new OffscreenCanvas(i.width, i.height); const g = cv.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, i.width, i.height).data
  const m = []; for (let k = 0; k < d.length; k += 4) m.push(d[k + 1] > 120 && d[k + 1] > d[k] + 50 && d[k + 1] > d[k + 2] + 50 ? 1 : 0)
  return m
}, png.toString('base64'))
const stableMask = async (p) => {
  let last = -1, png, mask
  for (let t = 0; t < 8; t++) {
    const f = await p.evaluate(() => window.cathodeFront.scene().stats.frames)
    await p.waitForFunction((f) => window.cathodeFront.scene().stats.frames > f + 3, f, { timeout: 60000 })
    png = await p.screenshot({ timeout: 120000 }); mask = await greenCount(p, png)
    const n = mask.reduce((s, v) => s + v, 0)
    if (last > 0 && Math.abs(n - last) < 0.01 * n) break
    last = n
  }
  return { png, mask }
}
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
// COATS='butcher=4f6a24,fixer=6c2458' tries other coat colours without a rebuild (a wrapper on FrontCath.coat).
const tryCoats = Object.fromEntries((process.env.COATS ?? '').split(',').filter(Boolean).map((s) => s.split('=')))
const CLASSES = (process.env.CLASSES ?? 'ghost,butcher,gunslinger,wirewitch,fixer').split(',')
const ALL = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']
// A CLASSES entry 'butcher:2f6b3a' measures that class in that coat (several tries in one run); NOFIG=1 skips the
// silhouette masks (about half the run).
for (const entry of CLASSES) {
  const [cls, hexTry] = entry.split(':')
  const i = ALL.indexOf(cls)
  if (hexTry) tryCoats[cls] = hexTry
  else if (CLASSES.some((e) => e.startsWith(cls + ':'))) delete tryCoats[cls]
  await p.evaluate((hex) => {
    const c = window.cathodeFront.scene().cath
    c.__coat ??= c.coat.bind(c)
    c.coat = hex ? (col) => { const x = c.coatMats[0].color.clone(); x.setHex(parseInt(hex, 16)); c.__coat(col ? x : null) } : c.__coat
  }, tryCoats[cls] ?? null)
  // A repeat of the class on stage wouldn't replay its audition (another pose, another light): step off it first.
  if (globalThis.__prevCls === cls) { await p.keyboard.press(String(((i + 1) % 5) + 1)); await p.waitForTimeout(3000) }
  globalThis.__prevCls = cls
  await p.keyboard.press(String(i + 1)); await p.waitForTimeout(4000); if (dir) await p.screenshot({ path: `${dir}/coat-${entry.replace(":", "-")}-D.png`, timeout: 120000 })
  const shotA = await p.screenshot({ timeout: 120000 })
  // Her coat alone, then her whole figure (coat, kit, umbrella; not the contact shadow), drawn in one shared flat
  // green (no fog, no tone mapping); shots repeat until the mask's size holds (a material still compiling is
  // skipped for a frame or two, which dropped whole parts from the mask).
  const paint = (coatOnly) => p.evaluate((coatOnly) => {
    const c = window.cathodeFront.scene().cath
    const M = c.coatMats[0].constructor // MeshStandardMaterial (or Physical): no THREE global on the page
    window.__green ??= Object.assign(new M({ color: 0, roughness: 1, metalness: 0 }), { fog: false, toneMapped: false })
    window.__green.emissive.set(0x00ff00); window.__green.emissiveIntensity = 1
    const set = new Set(c.coatMats)
    window.__sw = []
    c.group.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent && (!coatOnly || set.has(o.material))) { window.__sw.push([o, o.material]); o.material = window.__green } })
  }, coatOnly)
  const restore = () => p.evaluate(() => { for (const [o, m] of window.__sw) o.material = m })
  await paint(true)
  const coat = await stableMask(p)
  await restore()
  if (!process.env.NOFIG) {
    await paint(false)
    const fig = await stableMask(p)
    if (dir) require('fs').writeFileSync(`${dir}/fig-${cls}-D.png`, fig.png)
    await restore()
    masks[entry] = fig.mask
  }
  out[entry] = await p.evaluate(async ([a, m]) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + a; await i.decode(); const W = i.width, H = i.height; const cv = new OffscreenCanvas(W, H); const g = cv.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, W, H).data
    const at = (x, y) => m[y * W + x] === 1
    let r = 0, gg = 0, bl = 0, n = 0
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!(at(x, y) && at(x - 2, y) && at(x + 2, y) && at(x, y - 2) && at(x, y + 2))) continue
      const k = (y * W + x) * 4; r += d[k]; gg += d[k + 1]; bl += d[k + 2]; n++
    }
    return { n, rgb: [r / n, gg / n, bl / n].map(Math.round) }
  }, [shotA.toString('base64'), coat.mask])
}
console.log(JSON.stringify(out))
const lab = (c) => {
  const [r, g, b] = c.map((v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92 })
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
}
const k = Object.keys(out), pr = []
for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = lab(out[k[i]].rgb), c = lab(out[k[j]].rgb); pr.push(`${k[i]}-${k[j]} dE ${Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]).toFixed(1)}`) }
console.log(pr.join(' | '))
const iou = []
if (!process.env.NOFIG) {
for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = masks[k[i]], c = masks[k[j]]; let I = 0, U = 0; for (let q = 0; q < a.length; q++) { I += a[q] & c[q]; U += a[q] | c[q] } iou.push(`${k[i]}-${k[j]} IoU ${(I / U).toFixed(3)}`) }
console.log(Object.fromEntries(k.map((c) => [c, masks[c].reduce((s, v) => s + v, 0)])))
console.log(iou.join(' | '))
}
await b.close()
