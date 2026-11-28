// Plan item 751: the Pin in her hand, P (844x390 sideways, phone preset) and D (1440x900, high): its parts and
// triangles, the viewmodel's share, its sway between frames 1 s apart, a shot and a crop of the hand.
// CATHODE_URL=... OUT=... node scripts/cathode-751-pin.mjs <tag> [P|D|PD]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'x', which = process.argv[3] ?? 'PD', out = process.env.OUT ?? 'e2e/screenshots/ns751'
mkdirSync(out, { recursive: true })
const url = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const v of which.split('')) {
  const phone = v === 'P'
  const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.addInitScript((q) => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: q })), phone ? 'phone' : 'high')
  await p.goto(`${url}?play&class=ghost${phone ? '&rs=0.5' : ''}`)
  await p.waitForFunction(() => !!window.cathode?.job && window.cathode.stats.frames >= 2, null, { timeout: 300000 })
  await p.waitForFunction(() => { const c = window.cathode; c.input.forced = { reload: true }; return !c.arsenal.lowered }, null, { timeout: 90000, polling: 1000 })
  await p.waitForFunction(() => window.cathode.arsenal.anim.dip < 0.05, null, { timeout: 90000, polling: 500 })
  await p.waitForTimeout(1500)
  const probe = () => p.evaluate(() => {
    const c = window.cathode; const root = c.arsenal.rig.root; root.updateMatrixWorld(true)
    let meshes = 0, tris = 0
    root.traverse((o) => { if (!o.isMesh || !o.visible) return; meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 })
    const a = c.arsenal.rig.action; const w = a.getWorldPosition(a.position.clone())
    const cv = c.world.renderer.domElement
    return { id: c.arsenal.weapon.id, meshes, tris: Math.round(tris), share: +(c.vmProbe().vmPx / (cv.width * cv.height)).toFixed(4), pin: [w.x, w.y, w.z].map((n) => +n.toFixed(5)), frames: c.stats.frames }
  })
  const m1 = await probe(); await p.waitForTimeout(1000); const m2 = await probe()
  console.log(v, JSON.stringify(m1), 'sway', +Math.hypot(m1.pin[0] - m2.pin[0], m1.pin[1] - m2.pin[1], m1.pin[2] - m2.pin[2]).toFixed(5))
  await p.screenshot({ path: `${out}/${tag}-${v}.png`, timeout: 180000 })
  const W = phone ? 844 : 1440, H = phone ? 390 : 900
  await p.screenshot({ path: `${out}/${tag}-${v}-zoom.png`, clip: { x: W * 0.55, y: H * 0.3, width: W * 0.45, height: H * 0.7 }, timeout: 180000 })
  await ctx.close()
}
await b.close()
