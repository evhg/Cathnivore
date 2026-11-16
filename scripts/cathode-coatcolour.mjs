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
for (const [i, cls] of ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer'].entries()) {
  await p.keyboard.press(String(i + 1)); await p.waitForTimeout(4000); if (dir) await p.screenshot({ path: `${dir}/coat-${cls}-D.png`, timeout: 120000 })
  const shotA = await p.screenshot({ timeout: 120000 })
  const f0 = await p.evaluate(() => { const c = window.cathodeFront.scene().cath; window.__sw = []; const set = new Set(c.coatMats); c.group.traverse((o) => { if (o.isMesh && set.has(o.material)) { window.__sw.push([o, o.material]); const m = o.material.clone(); m.customProgramCacheKey = () => 'coatmask'; m.color.set(0); m.emissive?.set(0x00ff00); m.emissiveIntensity = 1; m.map = null; m.emissiveMap = null; m.needsUpdate = true; o.material = m } }); return window.cathodeFront.scene().stats.frames })
  await p.waitForFunction((f) => window.cathodeFront.scene().stats.frames > f + 3, f0, { timeout: 60000 })
  const shotB = await p.screenshot({ timeout: 120000 })
  await p.evaluate(() => { for (const [o, m] of window.__sw) o.material = m })
  out[cls] = await p.evaluate(async ([a, c]) => {
    const load = async (u) => { const i = new Image(); i.src = 'data:image/png;base64,' + u; await i.decode(); const cv = new OffscreenCanvas(i.width, i.height); const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return { W: i.width, H: i.height, d: g.getImageData(0, 0, i.width, i.height).data } }
    const A = await load(a), B = await load(c); const { W, H } = A
    const green = (x, y) => { const k = (y * W + x) * 4; return B.d[k + 1] > 120 && B.d[k + 1] > B.d[k] + 60 && B.d[k + 1] > B.d[k + 2] + 60 }
    let r = 0, g = 0, bl = 0, n = 0
    for (let y = 2; y < H - 2; y += 1) for (let x = 2; x < W - 2; x += 1) {
      if (!(green(x, y) && green(x - 2, y) && green(x + 2, y) && green(x, y - 2) && green(x, y + 2))) continue
      const k = (y * W + x) * 4; r += A.d[k]; g += A.d[k + 1]; bl += A.d[k + 2]; n++
    }
    return { n, rgb: [r / n, g / n, bl / n].map(Math.round) }
  }, [shotA.toString('base64'), shotB.toString('base64')])
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
await b.close()
