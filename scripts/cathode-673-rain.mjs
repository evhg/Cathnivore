// Plan item 673: the street at D (high preset, ?shot) with the rain on, then with the mesh named "rain" hidden; compare the
// two shots (e2e/screenshots/ns658/rain-on2.png, rain-off2.png) for pixels the rain darkens. CATHODE preview on :4175.
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
await p.goto('http://localhost:4175/nightshift/?play&class=ghost&shot')
await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) >= 3, null, { timeout: 240000 })
await p.waitForTimeout(3000)
console.log(await p.evaluate(() => { const c = window.cathode; const keys = Object.keys(c).filter(k => /world|scene|render/i.test(k)); return keys.join(',') }))
await p.screenshot({ path: 'e2e/screenshots/ns658/rain-on2.png' })
const ok = await p.evaluate(() => { const c = window.cathode; const sc = c.world?.scene ?? c.scene; if (!sc) return 'no scene'; const r = []; sc.traverse((o) => { if (o.name === 'rain') { o.visible = false; r.push(o.name) } }); return r.join(',') || 'none' })
console.log('hid', ok)
const f0 = await p.evaluate(() => window.cathode.stats.frames)
await p.waitForFunction((f) => window.cathode.stats.frames >= f + 2, f0, { timeout: 120000 })
await p.screenshot({ path: 'e2e/screenshots/ns658/rain-off2.png' })
await b.close()
