// Plan item 724: the street's shop signs and near people, a live frame at D and L (phone tier).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
//   node scripts/cathode-724-shots.mjs <outdir> [tag]   (SIZES=D,L)
import { chromium } from 'playwright'
const out = process.argv[2] ?? 'e2e/screenshots'
const tag = process.argv[3] ?? 'after'
const sizes = (process.env.SIZES ?? 'D,L').split(',')
const VP = { D: { width: 1440, height: 900 }, L: { width: 844, height: 390 } }
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const n of sizes) {
  const ctx = await b.newContext({ viewport: VP[n], ...(n === 'L' ? { isMobile: true, hasTouch: true } : {}) })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  await p.goto(`http://localhost:4186/nightshift/?play&class=gunslinger` + (n === 'L' ? '&quality=phone' : ''))
  await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) > 5, null, { timeout: 240000 })
  await p.waitForTimeout(8000)
  const info = await p.evaluate(() => {
    const c = window.cathode
    const w = c.world
    const out = { frames: c.stats.frames, signs: [], people: [] }
    const cam = w.camera
    const H = innerHeight
    for (const s of w.signDefs?.() ?? []) {
      const d = Math.hypot(s.center.x - c.player.pos.x, s.center.z - c.player.pos.z)
      if (d > 40) continue
      const a = s.center.clone().addScaledVector(cam.up, s.h / 2).project(cam)
      const z = s.center.clone().addScaledVector(cam.up, -s.h / 2).project(cam)
      const on = a.z < 1 && Math.abs(a.x) < 1.05 && Math.abs(a.y) < 1.05
      out.signs.push({ t: s.text, d: Math.round(d), on, px: Math.round(Math.abs(a.y - z.y) / 2 * H * 0.66), x: Math.round((a.x + 1) / 2 * innerWidth), y: Math.round((1 - a.y) / 2 * H) })
    }
    for (const s of w.street?.snapshot() ?? []) {
      const d = Math.hypot(s.x - c.player.pos.x, s.z - c.player.pos.z)
      if (d > 20 || s.mood === 'gone') continue
      const v = cam.position.clone().set(s.x, s.y + 1.0, s.z).project(cam)
      const top = cam.position.clone().set(s.x, s.y + 1.6, s.z).project(cam)
      const foot = cam.position.clone().set(s.x, s.y + 0.4, s.z).project(cam)
      const hh = Math.abs(top.y - foot.y) / 2 * H
      if (v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95) out.people.push({ d: Math.round(d * 10) / 10, x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * H), hh: Math.round(hh) })
    }
    return out
  })
  const buf = await p.screenshot({ path: `${out}/${tag}-${n}.png`, timeout: 240000 })
  // Mean luminance of each near person's middle (a box a quarter of their 1.2 m torso wide, the torso's height).
  info.lum = await p.evaluate(async ({ b64, people }) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const cv = new OffscreenCanvas(img.width, img.height)
    const g = cv.getContext('2d')
    g.drawImage(img, 0, 0)
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const vals = people.filter((q) => q.hh >= 12).map((q) => {
      const w = Math.max(2, Math.round(q.hh * 0.25)), h = Math.max(2, Math.round(q.hh * 0.9))
      const d = g.getImageData(q.x - w / 2, q.y - h / 2, w, h).data
      let s = 0
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
      return s / (d.length / 4)
    })
    return { n: vals.length, mean: vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length) }
  }, { b64: buf.toString('base64'), people: info.people })
  console.log(tag, n, JSON.stringify(info))
  await ctx.close()
}
await b.close()
