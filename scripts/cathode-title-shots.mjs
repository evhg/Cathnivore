// Plan item 261: NIGHT SHIFT title shots at frozen loop times (`?shot&t=`). A dist-site preview on :4180.
//   OUT=prefix TS=8,30 SIZES="D,1440,900;P,390,844" node scripts/cathode-title-shots.mjs
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [n, w, h] of (process.env.SIZES ?? 'D,1440,900;P,390,844').split(';').map(s => s.split(','))) {
  for (const t of (process.env.TS ?? '8,30').split(',')) {
    const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage()
    await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await p.goto(`http://localhost:4180/nightshift/?shot&t=${t}${process.env.Q ?? ''}`)
    await p.waitForFunction(() => window.cathodeFront?.scene?.(), null, { timeout: 120000 })
    await p.waitForTimeout(6000)
    await p.screenshot({ path: `${process.env.OUT}-${n}-t${t}.png` })
    await p.close()
  }
}
await b.close()
