// Plan item 727: is any of NIGHT SHIFT Cath's long hair inside her coat? Loads the title (and, with PICK=1, the class
// pick for each class) on a dist-site preview (PORT, default 4180) and prints scene().hairInCoat() at loop times
// 0..27 s and for each menu mood. SHOT=dir writes a frame per sample.
import { chromium } from '@playwright/test'
const vw = +(process.env.W ?? 1440), vh = +(process.env.H ?? 900), port = process.env.PORT ?? 4180
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage()
await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
const pick = !!process.env.PICK
await p.goto(`http://localhost:${port}/nightshift/${pick ? "?play&rs=0.5" : "?shot"}`)
await p.waitForFunction(() => !!window.cathodeFront?.scene(), null, { timeout: 240000 })
if (pick) await p.waitForSelector(".cp", { timeout: 240000 })
await p.waitForTimeout(3000)
const sample = (label) => p.evaluate((label) => ({ label, ...window.cathodeFront.scene().hairInCoat() }), label)
const out = []
if (!pick) {
  for (const t of [0, 4, 9, 13, 18, 22, 27]) {
    await p.evaluate((t) => window.cathodeFront.scene().setTime(t), t)
    await p.waitForTimeout(400)
    out.push(await sample(`t${t}`))
  }
  for (const mood of ['new', 'continue', 'cases', 'settings', 'credits']) {
    await p.evaluate((m) => window.cathodeFront.scene().menuMood(m), mood)
    await p.waitForTimeout(2500)
    out.push(await sample(mood))
  }
} else {
  for (const cls of ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']) {
    await p.locator(`.cp-opt[data-cls=${cls}]`).click()
    for (let i = 0; i < 4; i++) { await p.waitForTimeout(3000); out.push(await sample(`${cls}${i}`)) }
  }
}
for (const o of out) console.log(JSON.stringify(o))
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT })
await b.close()
