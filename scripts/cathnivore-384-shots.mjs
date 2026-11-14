// Plan item 384: the one Sell card at P, P2 (375x667) and D, light and dark, with count 2 picked.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-384-shots.mjs http://localhost:4191 <outdir>
import { chromium } from '@playwright/test'
const [base, out] = [process.argv[2], process.argv[3]]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const scheme of ['light','dark']) for (const [n,w,h,t] of [['P',390,844,true],['P2',375,667,true],['D',1440,900,false]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: t, colorScheme: scheme })).newPage()
  await p.goto(base + '/?seed=11')
  await p.getByText('Quick Game').click()
  await p.locator('input[inputmode="numeric"]').waitFor({ state: 'attached' })
  const adv = p.getByRole('button', { name: 'Advanced' })
  if ((await adv.isVisible()) && (await adv.getAttribute('aria-expanded')) !== 'true') await adv.click()
  await p.locator('input[inputmode="numeric"]').fill('11')
  await p.locator('.setup-start').click()
  await p.locator('.game').waitFor()
  await p.mouse.move(5, 5)
  await p.waitForTimeout(1200)
  const sell = p.locator('.action-sell').first()
  await sell.scrollIntoViewIfNeeded()
  await p.getByRole('button', { name: '2 to sell' }).click()
  await p.mouse.move(5, 5)
  await p.waitForTimeout(600)
  console.log(n, scheme, await sell.locator('> button').first().getAttribute('aria-label'), JSON.stringify(await sell.boundingBox()))
  await p.screenshot({ path: `${out}/sel-${n}-${scheme}.png` })
  await p.context().close()
}
await b.close()
