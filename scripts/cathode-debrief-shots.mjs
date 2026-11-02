// Plan item 17: the morning-after debrief at D and L. A save with the clinic register taken, the clinic loaded,
// three stills grabbed from three looks down the ward, a graze, then Vane's case closed through the job's hook.
// Shots: mid count-up and landed. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
// then node scripts/cathode-debrief-shots.mjs (SIZE=desktop|landscape for one).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const ONLY = process.env.SIZE
const SIZES = [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['landscape', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }],
]
const JOBS = ['fishMarket', 'crispLead', 'quayContracts', 'candorManifest', 'crispBoss', 'vaneLead']
for (const [name, opts] of SIZES.filter(([n]) => !ONLY || n === ONLY)) {
  const page = await browser.newPage(opts)
  await page.goto(base)
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'low' })))
  await page.goto(`${base}?play&class=ghost`)
  await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200000 })
  await page.evaluate((jobs) => {
    window.cathode.progress.jobsDone.push(...jobs)
    window.cathode.progress.save()
  }, JOBS)
  await page.goto(`${base}?play&district=clinic`)
  await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200000 })
  await page.waitForTimeout(3000)
  const looks = [[0, 0, 'Headshot · 23 m', 60], [0.6, -0.05, 'Takedown', 50], [-0.5, 0.02, 'Down · 14 m', 30]]
  for (const [yaw, pitch, cap, score] of looks) {
    await page.evaluate(([y, p, c, sc]) => {
      window.cathode.player.yaw = y
      window.cathode.player.pitch = p
      window.cathode.grabStill(c, sc)
    }, [yaw, pitch, cap, score])
    await page.waitForTimeout(2500)
  }
  await page.evaluate(() => {
    const c = window.cathode
    c.hurtCath(30, null, 'bullet')
    c.debriefDelayMs = 300
    c.debriefStay = true
    c.finishCase()
  })
  await page.waitForSelector('.debrief', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/debrief-mid-${name}.png`, timeout: 120000 })
  await page.waitForSelector('.debrief.is-counted', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/debrief-${name}.png`, timeout: 120000 })
  console.log(`debrief-${name}`, await page.evaluate(() => JSON.stringify(window.cathode.debrief)))
  await page.close()
}
await browser.close()
