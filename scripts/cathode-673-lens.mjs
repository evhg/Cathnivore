// Plan item 673: the street at a viewport (high, ?shot, ?rs=), shot before and after three raindrops on the lens (`window.cathode.lensDrop`). NIGHT SHIFT preview on :4175.
// PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-673-lens.mjs <out-prefix> <w> <h> [rs]
import { chromium } from '@playwright/test'
const out = process.argv[2], vw = +process.argv[3], vh = +process.argv[4], rs = process.argv[5] ?? '1'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: vw, height: vh } })
await p.addInitScript((q) => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: q })), process.env.Q ?? 'high')
await p.goto(`http://localhost:4175/nightshift/?play&class=ghost&shot&rs=${rs}`)
await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) >= 3, null, { timeout: 300000 })
await p.waitForTimeout(2000)
const f = async () => { const f0 = await p.evaluate(() => window.cathode.stats.frames); await p.waitForFunction((f) => window.cathode.stats.frames >= f + 2, f0, { timeout: 180000 }) }
await p.screenshot({ path: `${out}-before.png`, timeout: 300000 })
const n = await p.evaluate(() => { const c = window.cathode; c.lensDrop(); c.lensDrop(); return c.lensDrop() })
await f()
await p.screenshot({ path: `${out}-drops.png`, timeout: 300000 })
console.log('drops', n)
await b.close()
