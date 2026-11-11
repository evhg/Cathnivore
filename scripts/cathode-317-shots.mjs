// Plan item 317: NIGHT SHIFT's phone title and pick at a real phone's DPR 3 (plus D), with Cath's box and the menu's box
// measured from the page. Usage: a dist-site preview on BASE, OUT=<dir> node scripts/cathode-317-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4186'
const out = process.env.OUT ?? 'e2e/screenshots/i317'
mkdirSync(out, { recursive: true })
const SIZES = {
  P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
  D: { viewport: { width: 1440, height: 900 } },
}
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const probe = () => {
  const c = document.querySelector('canvas')
  return { css: [c?.clientWidth, c?.clientHeight], store: [c?.width, c?.height], cath: c?.dataset.cathBox ?? null }
}
for (const [s, o] of Object.entries(SIZES)) {
  if (only && !only.includes(s)) continue
  const ctx = await browser.newContext(o)
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto(`${base}/nightshift/`); await p.waitForTimeout(30000)
  await p.screenshot({ path: `${out}/ns-title-${s}.png` })
  console.log(s, 'title', JSON.stringify(await p.evaluate(probe)))
  await p.goto(`${base}/nightshift/?play`)
  await p.waitForFunction(() => document.querySelector('canvas')?.dataset.class, null, { timeout: 90000 }).catch(() => {})
  await p.waitForTimeout(15000)
  await p.screenshot({ path: `${out}/ns-play-${s}.png` })
  console.log(s, 'play', JSON.stringify(await p.evaluate(probe)))
  await ctx.close()
}
await browser.close()
