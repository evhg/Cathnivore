// Plan item 701: the phone hand at rest and after a swipe (390x844, 375x812, 430x932).
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-701p-shots.mjs http://localhost:4191 <outdir> <tag>
import { chromium } from '@playwright/test'
const [base, out, tag] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const [n, w, h] of [['P', 390, 844], ['P375', 375, 812], ['P430', 430, 932]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })).newPage()
  await p.goto(base + '/?seed=7&e2eHandFan=1')
  await p.getByText('Quick Game').click()
  await p.locator('.setup-start').click()
  await p.locator('.game').waitFor()
  await p.waitForTimeout(1500)
  const probe = () => p.evaluate(() => {
    const row = document.querySelector('.action-tray .actions')
    const cards = [...row.querySelectorAll(':scope > .action-item')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), (e.hasAttribute('data-hand-card') ? 'h' : 'l') + (e.hasAttribute('data-lifted') ? '*' : '')] })
    return { fan: row.dataset.fan, scroll: Math.round(row.scrollLeft), sw: row.scrollWidth, cw: row.clientWidth, cards }
  })
  console.log(n, 'rest', JSON.stringify(await probe()))
  await p.screenshot({ path: `${out}/${tag}-${n}-rest.png` })
  await p.evaluate(() => document.querySelector('.action-tray .actions').scrollBy({ left: 140, behavior: 'instant' }))
  await p.waitForTimeout(800)
  console.log(n, 'swiped', JSON.stringify(await probe()))
  await p.screenshot({ path: `${out}/${tag}-${n}-swiped.png` })
  await p.context().close()
}
await b.close()
