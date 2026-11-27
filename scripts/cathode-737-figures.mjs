// Plan item 737: do the street's people read at 15-28 m on a phone held sideways? A frozen (`?shot`) first-job frame
// at 844x390 (phone tier), shot with and without the street's people; each person's own pixels are where the two
// differ, and their mean luminance is set against the same pixels without them (WCAG contrast). Bar: 3:1 at 20 m.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-737-figures.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/ns737'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
const p = await ctx.newPage()
await p.goto('http://localhost:4186/nightshift/?play&class=gunslinger&shot&hud=0')
await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) > 5, null, { timeout: 240000 })
await p.waitForTimeout(Number(process.env.T ?? 6000))
const people = await p.evaluate(() => {
  const c = window.cathode, cam = c.world.camera, W = innerWidth, H = innerHeight
  const r = []
  for (const s of c.world.street?.snapshot() ?? []) {
    const d = Math.hypot(s.x - c.player.pos.x, s.z - c.player.pos.z)
    if (d < 8 || d > 30 || s.mood === 'gone') continue
    const P = (y) => cam.position.clone().set(s.x, s.y + y, s.z).project(cam)
    const top = P(1.85), foot = P(0), mid = P(1)
    if (mid.z >= 1 || Math.abs(mid.x) > 0.95 || Math.abs(mid.y) > 0.95) continue
    const y0 = (1 - top.y) / 2 * H, y1 = (1 - foot.y) / 2 * H, x = (mid.x + 1) / 2 * W, h = y1 - y0
    r.push({ d: Math.round(d * 10) / 10, box: [Math.round(x - h * 0.3), Math.round(y0), Math.round(x + h * 0.3), Math.round(y1)] })
  }
  return r
})
const shotA = await p.screenshot({ path: `${out}/${tag}-fig-L.png`, timeout: 240000 })
const f0 = await p.evaluate(() => {
  window.cathode.world.scene.traverse((o) => { if (o.name === 'streetlife') o.visible = false })
  return window.cathode.stats.frames
})
await p.waitForFunction((f) => window.cathode.stats.frames >= f + 3, f0, { timeout: 120000 })
const shotB = await p.screenshot({ timeout: 240000 })
const res = await p.evaluate(async ({ a, bb, people }) => {
  const load = async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const cv = new OffscreenCanvas(img.width, img.height), g = cv.getContext('2d')
    g.drawImage(img, 0, 0)
    return g.getImageData(0, 0, img.width, img.height)
  }
  const A = await load(a), B = await load(bb)
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const Y = (d, i) => 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
  return people.map((q) => {
    let n = 0, fa = 0, fb = 0
    const [x0, y0, x1, y1] = q.box
    for (let y = Math.max(0, y0); y < Math.min(A.height, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(A.width, x1); x++) {
        const i = (y * A.width + x) * 4
        const ya = Y(A.data, i), yb = Y(B.data, i)
        if (Math.abs(ya - yb) < 0.004 && Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) < 12) continue
        n++; fa += ya; fb += yb
      }
    if (n < 6) return { ...q, n }
    fa /= n; fb /= n
    return { ...q, n, fig: +fa.toFixed(4), bg: +fb.toFixed(4), cr: +((Math.max(fa, fb) + 0.05) / (Math.min(fa, fb) + 0.05)).toFixed(2), lumRatio: +(Math.max(fa, fb) / Math.max(1e-4, Math.min(fa, fb))).toFixed(2) }
  })
}, { a: shotA.toString('base64'), bb: shotB.toString('base64'), people })
for (const r of res.sort((x, y) => x.d - y.d)) console.log(tag, JSON.stringify(r))
await b.close()
