// Plan item 385: the title's Daily tag at P (390x844, 375x667) and the Quick Game setup at D.
//   node scripts/cathnivore-385-shots.mjs http://localhost:<port> <outdir> [tag]
import { chromium } from '@playwright/test'
const [base, out, tag = 'x'] = [process.argv[2], process.argv[3], process.argv[4]]
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const [n, w, h] of [['P', 390, 844], ['P2', 375, 667]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true })
  await p.goto(base + '/')
  await p.locator('.title-daily').waitFor()
  await p.waitForTimeout(1500)
  const box = await p.locator('.title-daily').boundingBox()
  console.log(n, JSON.stringify(box), await p.locator('.title-daily small').evaluate((e) => getComputedStyle(e).fontSize))
  await p.screenshot({ path: `${out}/daily-${n}-${tag}.png`, clip: { x: 0, y: box.y - 20, width: w, height: box.height + 40 } })
  await p.close()
}
for (const [n, w, h] of [['D', 1440, 900], ['D2', 1280, 800]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.goto(base + '/')
  await p.getByText('Quick Game').click()
  await p.locator('[data-flyer]').waitFor()
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/setup-${n}-${tag}.png` })
  await p.close()
}
await b.close()
