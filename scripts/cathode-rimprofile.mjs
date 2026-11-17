// Plan item 463: Cath's coat rim on the title, measured. Shoots the title's still frame (?shot, t 8) at D and P,
// plain and with her coat drawn flat green (a mask), and saves both; `scripts/cathode-rimprofile.py <dir>` then reads
// each row through the coat: its outer 2 px on each side against the cloth 6-14 px inside.
//   SITE_URL=http://localhost:4186 PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-rimprofile.mjs <dir>
import { chromium } from '@playwright/test'
const base = process.env.SITE_URL ?? 'http://localhost:4186'
const dir = process.argv[2] ?? '.'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [name, vp] of [['D', { width: 1440, height: 900 }], ['P', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 })
  await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto(`${base}/nightshift/?shot`)
  await p.waitForFunction(() => window.cathodeFront?.scene?.(), null, { timeout: 200000 })
  // The title's static poster sits over the live canvas in headless runs: hide it, and the page's UI.
  const still = async () => {
    await p.evaluate(() => window.cathodeFront.scene().setTime(8))
    await p.waitForTimeout(12000)
  }
  await p.addStyleTag({ content: 'img, picture, .front-ui, .menu, .list { visibility: hidden !important }' })
  await still()
  await p.screenshot({ path: `${dir}/rim-${name}.png`, timeout: 120000 })
  await p.evaluate(() => {
    const c = window.cathodeFront.scene().cath
    const M = c.coatMats[0].constructor
    const g = Object.assign(new M({ color: 0, roughness: 1, metalness: 0 }), { fog: false, toneMapped: false })
    g.emissive.set(0x00ff00)
    const set = new Set(c.coatMats)
    c.group.traverse((o) => { if (o.isMesh && set.has(o.material)) o.material = g })
  })
  await still()
  await p.screenshot({ path: `${dir}/rim-${name}-mask.png`, timeout: 120000 })
  console.log('shot', name)
  await p.close()
}
await b.close()
