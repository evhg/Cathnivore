// Plan item 647: each vehicle on the Almanac's turntable, one canvas shot each (the branded panel judged up close).
// OUT=dir node scripts/hedgerow-647-turntable.mjs <tag>  (a dist-site preview on :4175)
import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'after', out = process.env.OUT ?? 'e2e/screenshots/h647'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:4175/hedgerow/?sandbox=1')
// every vehicle met, so the Almanac's Enemies tab lists them all
await p.evaluate(() => {
  const kinds = ['van', 'courier', 'hatchback', 'pickup', 'sprinter', 'lorry', 'quad', 'wrapped', 'steel', 'artic', 'transporter', 'truck', 'convoy', 'influencer']
  const seen = Object.fromEntries(kinds.map((k) => [k, true]))
  localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seen, seenBefore: {}, tips: { all: true } }))
})
await p.reload(); await p.waitForTimeout(1000)
await p.locator('#btn-almanac').click()
await p.waitForTimeout(800)
const tabs = await p.locator('#dlg-almanac [role="tab"]').allTextContents()
console.log('tabs', JSON.stringify(tabs))
const veh = p.locator('#dlg-almanac [role="tab"]').filter({ hasText: /vehicle|fleet|enem/i }).first()
if (await veh.count()) { await veh.click(); await p.waitForTimeout(600) }
const views = p.locator('#dlg-almanac .alm-card:visible .alm-view')
const n = await views.count()
console.log('views', n)
for (let i = 0; i < Math.min(n, 12); i++) {
  const name = (await p.locator('#dlg-almanac .alm-card:visible').nth(i).innerText()).split('\n')[0]
  await views.nth(i).click()
  await p.waitForTimeout(2500)
  await p.locator('#almanac-canvas').screenshot({ path: `${out}/${tag}-tt-${i}.png` })
  console.log(i, name)
  await p.keyboard.press('Escape').catch(() => {})
  await p.waitForTimeout(300)
  if (!(await p.locator('#dlg-almanac').isVisible())) { await p.locator('#btn-almanac').click(); await p.waitForTimeout(500); if (await veh.count()) await veh.click() }
}
await b.close()
