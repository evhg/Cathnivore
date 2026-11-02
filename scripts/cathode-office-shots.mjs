// Plan item 16: Cath's office (the hub) at D and L, from the door and facing each station.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/cathode-office-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['landscape', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }],
]
// Yaw 0 looks down -z (the cork wall). Each view: [name, x, z, yaw].
const VIEWS = [['room', 0, 3.4, 0.35], ['bench', 1.6, 0.2, -1.3], ['desk', 0.4, 0.2, 1.9], ['at-bench', 3.4, -0.6, -1.5708], ['at-door', 3.1, 1.7, 3.1416]]
for (const [name, opts] of SIZES) {
  const page = await browser.newPage(opts)
  await page.goto(base)
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'low' })))
  await page.goto(`${base}?play&shot&district=office`)
  await page.waitForFunction(() => window.cathode?.player, null, { timeout: 120000 })
  for (const [v, x, z, yaw] of VIEWS) {
    await page.evaluate(([x, z, yaw]) => {
      const p = window.cathode.player
      p.pos.set(x, p.pos.y, z)
      p.yaw = yaw
      p.pitch = -0.08
    }, [x, z, yaw])
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${out}/office-${v}-${name}.png`, timeout: 120000 })
    console.log(`office-${v}-${name}`)
  }
  await page.close()
}
await browser.close()
