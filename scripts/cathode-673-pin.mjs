// Plan item 673: the Pin in her hand at D (1440x900, high preset): once her first input raises it, the viewmodel's
// share of the frame and a shot. CATHODE_URL=... node scripts/cathode-673-pin.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'x', out = process.env.OUT ?? 'e2e/screenshots/ns673'
mkdirSync(out, { recursive: true })
const url = process.env.CATHODE_URL ?? 'http://localhost:4175/nightshift/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
await p.goto(`${url}?play&class=ghost`)
await p.waitForFunction(() => !!window.cathode?.job && window.cathode.stats.frames >= 2, null, { timeout: 240000 })
await p.waitForFunction(() => { const c = window.cathode; c.input.forced = { reload: true }; return !c.arsenal.lowered }, null, { timeout: 90000, polling: 1000 })
await p.waitForFunction(() => window.cathode.arsenal.anim.dip < 0.05, null, { timeout: 90000, polling: 500 })
await p.waitForTimeout(1500)
const m = await p.evaluate(() => { const c = window.cathode; const cv = c.world.renderer.domElement; return { share: +(c.vmProbe().vmPx / (cv.width * cv.height)).toFixed(4), id: c.arsenal.weapon.id } })
console.log(JSON.stringify(m))
await p.screenshot({ path: `${out}/${tag}-D.png` })
await b.close()
