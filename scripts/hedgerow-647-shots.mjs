// Plan item 647: level 34 (Same-Day vans, box lorries) in 3D at D with two rounds sent, so the fleet queues at the gate (full frame and a 2x crop
// of the depot's queue). OUT=dir node scripts/hedgerow-647-shots.mjs <tag>  (a dist-site preview on :4175)
import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'after', out = process.env.OUT ?? 'e2e/screenshots/h647'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:4175/hedgerow/?sandbox=1')
await p.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [String(i + 1), 3])), seenBefore: { 34: true }, seen: {}, tips: { all: true } })))
await p.goto('http://localhost:4175/hedgerow/?sandbox=1&level=34')
await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
await p.waitForTimeout(5000)
await p.evaluate(() => { const h = window.hedgerow; h.sendWave(h.game(), true); h.sendWave(h.game(), true) })
await p.waitForTimeout(9000)
await p.screenshot({ path: `${out}/${tag}-l34-3d-D.png` })
await p.screenshot({ path: `${out}/${tag}-queue.png`, clip: { x: 60, y: 120, width: 520, height: 400 } })
await b.close()
