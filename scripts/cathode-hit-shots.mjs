// C1 shots: the hit marker (body, head, kill, soft) and the "blocked by cover" tag at 1440x900 and 2560x1440@2x.
// Usage: npx vite preview --outDir dist-site --port 4180 &  then  node scripts/cathode-hit-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATHODE_URL ?? 'http://localhost:4180/cathode/'
const out = process.env.OUT ?? 'e2e/screenshots'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [name, vp, dsf] of [['D', { width: 1440, height: 900 }, 1], ['5K', { width: 2560, height: 1440 }, 2]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: dsf })
  await page.goto(base + '?play&shot')
  await page.waitForTimeout(4000)
  for (const kind of ['body', 'head', 'kill', 'soft', 'blocked']) {
    await page.evaluate((k) => {
      const hit = document.querySelector('.hud-hit'), bl = document.querySelector('.hud-blocked')
      for (const e of [hit, bl]) { e.style.animation = 'none'; e.style.setProperty('--a', '0') }
      hit.className = 'hud-hit' + (k === 'head' ? ' head' : k === 'kill' ? ' kill' : k === 'soft' ? ' soft' : '')
      if (k === 'blocked') bl.style.setProperty('--a', '1'); else hit.style.setProperty('--a', '1')
    }, kind)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/c1-hit-${kind}-${name}.png`, clip: { x: vp.width / 2 - 160, y: vp.height / 2 - 120, width: 320, height: 240 } })
  }
  await page.screenshot({ path: `${out}/c1-full-${name}.png` })
  await page.close()
}
await browser.close()
