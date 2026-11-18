// Plan item 494: how much of Cath's silhouette the title's morning paper covers (accept: 5% or less at P and D).
// Draws her flat green in the title's own framing (as scripts/cathode-coatband.mjs), hides the paper (it is absolutely
// placed, so the camera's framing doesn't move), and counts her pixels inside the paper's box against all of hers.
//   SITE_URL=http://localhost:4175 node scripts/cathode-paper-cover.mjs [P|D]
import { chromium } from '@playwright/test'
const size = (process.argv[2] ?? 'D') === 'P' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
const base = process.env.SITE_URL ?? 'http://localhost:4175'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: size, deviceScaleFactor: 1, hasTouch: size.width < 600 })
await p.goto(base + '/nightshift/?shot')
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })) })
await p.goto(base + '/nightshift/?shot&front=title&t=8')
await p.waitForFunction(() => window.cathodeFront?.ready && window.cathodeFront.scene()?.stats?.frames >= 1, null, { timeout: 240_000 })
await p.evaluate(() => { const f = document.getElementById('front-fallback'); if (f) f.style.opacity = '0' })
const box = await p.evaluate(() => { const r = document.getElementById('dossier').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] })
await p.evaluate(() => {
  document.getElementById('dossier').style.visibility = 'hidden'
  const g = window.cathodeFront.scene().cath.group
  g.traverse((o) => { if (o.isMesh) { const m = o.material.clone(); m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => 'mask'; m.color?.set(0x000000); m.emissive?.set(0x00ff00); m.emissiveIntensity = 0.6; m.map = null; m.emissiveMap = null; m.vertexColors = false; m.roughness = 1; m.metalness = 0; m.clearcoat = 0; m.sheen = 0; m.envMapIntensity = 0; m.needsUpdate = true; o.material = m } })
})
const f0 = await p.evaluate(() => window.cathodeFront.scene().stats.frames)
await p.evaluate(() => window.cathodeFront.scene().setTime(8))
await p.waitForFunction((f) => window.cathodeFront.scene().stats.frames > f, f0, { timeout: 240_000 })
await p.waitForTimeout(500)
const shot = (await p.screenshot()).toString('base64')
const r = await p.evaluate(async ([s, box]) => {
  const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode()
  const cv = new OffscreenCanvas(i.width, i.height); const g = cv.getContext('2d'); g.drawImage(i, 0, 0)
  const d = g.getImageData(0, 0, i.width, i.height).data
  let all = 0, under = 0
  for (let y = 0; y < i.height; y++) for (let x = 0; x < i.width; x++) {
    const k = (y * i.width + x) * 4
    if (d[k + 1] > 90 && d[k + 1] > 1.6 * d[k] && d[k + 1] > 1.6 * d[k + 2]) { all++; if (x >= box[0] && x < box[2] && y >= box[1] && y < box[3]) under++ }
  }
  return { all, under, share: +(under / Math.max(1, all)).toFixed(4), box }
}, [shot, box])
console.log(JSON.stringify(r))
await b.close()
