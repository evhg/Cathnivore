// Plan item 147: shoots the NIGHT SHIFT title at D and P and a close crop round her right fist on the umbrella.
// Needs a dist-site preview on :4190. Usage: node scripts/cathode-hand-shot.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] || 'x'
const out = 'e2e/screenshots/body147'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['D', { width: 1440, height: 900 }], ['P', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 })
  await p.goto('http://localhost:4190/nightshift/?shot')
  await p.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
  await p.goto('http://localhost:4190/nightshift/?front=title&shot&t=8')
  await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 200000 })
  await p.waitForTimeout(3000)
  const c = await p.evaluate(() => {
    const w = window.cathodeFront.scene().world
    const m = w.scene.getObjectByName('cath-fist-r')
    if (!m) return null
    const v = m.geometry.boundingSphere ? m.geometry.boundingSphere.center.clone() : (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere.center.clone())
    m.localToWorld(v); v.project(w.camera)
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }
  })
  await p.screenshot({ path: `${out}/${tag}-${n}.png` })
  if (c) {
    const s = n === 'D' ? 160 : 90
    await p.screenshot({ path: `${out}/${tag}-${n}-fist.png`, clip: { x: Math.max(0, c.x - s / 2), y: Math.max(0, c.y - s / 2), width: s, height: s } })
  }
  console.log(n, JSON.stringify(c))
  await p.close()
}
await b.close()
