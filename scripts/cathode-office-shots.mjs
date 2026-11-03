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
const ALL = [['room', 0, 3.4, 0.35], ['bench', 1.6, 0.2, -1.3], ['desk', 0.4, 0.2, 1.9], ['at-bench', 3.4, -0.6, -1.5708], ['at-door', 3.1, 1.7, 3.1416],
  // Plan item 51: the trophy shelf (west wall) and Bea's drawings (south wall by the door).
  ['shelf', -2.6, -0.35, 1.5708], ['drawings', 1.3, 1.2, 3.1416]]
const VIEWS = process.env.VIEWS ? ALL.filter(([v]) => process.env.VIEWS.split(',').includes(v)) : ALL
// CASES=n: a save with the first n cases closed (0-5), written by the game's own Progress and reloaded.
const CLOSE = ['crispBoss', 'vaneBoss', 'pellBoss', 'boardBoss', 'vaultBoss']
const cases = Number(process.env.CASES ?? 0)
const tag = process.env.TAG ?? ''
for (const [name, opts] of SIZES) {
  const page = await browser.newPage(opts)
  await page.goto(base)
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'low' })))
  await page.goto(`${base}?play&shot&district=office`)
  await page.waitForFunction(() => window.cathode?.player, null, { timeout: 120000 })
  if (cases) {
    await page.evaluate((jobs) => {
      const p = window.cathode.progress
      for (const j of ['fishMarket', 'crispLead', ...jobs]) if (!p.jobsDone.includes(j)) p.jobsDone.push(j)
      p.save()
    }, CLOSE.slice(0, cases))
    await page.goto(`${base}?play&shot&district=office`)
    await page.waitForFunction(() => window.cathode?.player, null, { timeout: 120000 })
    console.log('dressing', JSON.stringify(await page.evaluate(() => window.cathode.officeDressing?.())))
  }
  await page.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) > 2, null, { timeout: 300000 })
  await page.evaluate(() => {
    document.getElementById('loading')?.setAttribute('hidden', '')
    document.getElementById('front-fallback')?.classList.add('is-off')
  })
  for (const [v, x, z, yaw] of VIEWS) {
    await page.evaluate(([x, z, yaw]) => {
      const p = window.cathode.player
      p.pos.set(x, p.pos.y, z)
      p.yaw = yaw
      p.pitch = -0.08
    }, [x, z, yaw])
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${out}/office${tag}-${v}-${name}.png`, timeout: 120000 })
    console.log(`office${tag}-${v}-${name}`)
  }
  await page.close()
}
await browser.close()
