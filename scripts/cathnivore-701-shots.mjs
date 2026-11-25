// Plan item 701: the desktop hand's hovered card held up to read (1440x900, 1280x800).
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-701-shots.mjs http://localhost:4191 <outdir> <tag>
import { chromium } from '@playwright/test'
const [base, out, tag] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const [n, w, h] of [['D', 1440, 900], ['D2', 1280, 800]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, colorScheme: process.env.SCHEME ?? 'light' })).newPage()
  await p.goto(base + '/?seed=7')
  await p.getByText('Quick Game').click()
  await p.locator('.setup-start').click()
  await p.locator('.game').waitFor()
  await p.mouse.move(5, 5); await p.waitForTimeout(1500)
  const cards = p.locator('.table-hand [data-hand-card]')
  const k = await cards.count()
  for (const i of [0, k - 1, 2]) {
    await cards.nth(i).hover(); await p.waitForTimeout(400)
    const r = await cards.nth(i).evaluate((e) => { const b = e.getBoundingClientRect(); const t = e.querySelector('.action-name, .action-label'); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom), Math.round(b.height), t ? getComputedStyle(t).fontSize : ''] })
    console.log(n, i, JSON.stringify(r))
    await p.screenshot({ path: `${out}/${tag}-${n}-c${i}.png` })
  }
  await p.context().close()
}
await b.close()
