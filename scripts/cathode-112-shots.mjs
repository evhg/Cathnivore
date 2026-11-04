import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'before'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [s, w, h] of [['D', 1440, 900], ['P', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: s === 'P' })
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto('http://localhost:4186/nightshift/?play'); await p.waitForTimeout(20000)
  await p.screenshot({ path: `e2e/screenshots/c112/${tag}-play-${s}.png` })
  if (process.env.SWITCH) { await p.click('.cp-opt[data-cls=butcher]'); await p.waitForTimeout(4000); await p.screenshot({ path: `e2e/screenshots/c112/${tag}-play-${s}-butcher.png` }) }
  await ctx.close()
}
await b.close()
