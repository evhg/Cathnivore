// Plan item 639: the market street's first frames at D (1440x900) and P (844x390, 2x), at 0 s and 4 s after the first
// drawn frames. Usage: (dist-site preview on :4175) node scripts/cathode-639-shots.mjs <outdir> <tag> [extra query]
import { chromium } from '@playwright/test'
const out = process.argv[2], tag = process.argv[3], extra = process.argv[4] ?? ''
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [s, vp, dpr] of [['D', { width: 1440, height: 900 }, 1], ['P', { width: 844, height: 390 }, 2]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, ...(s === 'P' ? { hasTouch: true, isMobile: true } : {}) })
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto(`http://localhost:4175/nightshift/?play&class=ghost&rs=0.5${extra}`)
  await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) >= 3, null, { timeout: 200000 }).catch(() => {})
  const t0 = Date.now()
  for (const at of [0, 4000]) {
    await p.waitForTimeout(Math.max(0, at - (Date.now() - t0)))
    await p.screenshot({ path: `${out}/${tag}-${s}-${at}.png` })
  }
  const info = await p.evaluate(() => { const c = window.cathode; return { frames: c?.stats?.frames, t: c?.time ?? null } })
  console.log(s, JSON.stringify(info))
  await ctx.close()
}
await browser.close()
