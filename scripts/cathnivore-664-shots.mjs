// Plan item 664: the desktop hand as a tray: board share by hex bounds, the hand's height, a hover and a keyboard focus.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-664-shots.mjs http://localhost:4191 <outdir> <tag> [css]
import { chromium } from '@playwright/test'
const [base, out, tag, css] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const [n, w, h] of [['D', 1440, 900], ['D2', 1280, 800]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage()
  await p.goto(base + '/?seed=7')
  await p.getByText('Quick Game').click()
  await p.locator('input[inputmode="numeric"]').waitFor({ state: 'attached' })
  const adv = p.getByRole('button', { name: 'Advanced' })
  if ((await adv.isVisible()) && (await adv.getAttribute('aria-expanded')) !== 'true') await adv.click()
  await p.locator('input[inputmode="numeric"]').fill('7')
  await p.locator('.setup-start').click()
  await p.locator('.game').waitFor()
  if (css) await p.addStyleTag({ content: css })
  await p.mouse.move(5, 5)
  await p.waitForTimeout(1500)
  console.log(n, JSON.stringify(await p.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    const hx = [...document.querySelectorAll('.region-hex > polygon.land-layer:first-child')].map(r)
    const u = [Math.min(...hx.map(a=>a[0])), Math.min(...hx.map(a=>a[1])), Math.max(...hx.map(a=>a[2])), Math.max(...hx.map(a=>a[3]))]
    const hand = document.querySelector('.table-hand')
    return { hex: u, share: +(((u[2]-u[0])*(u[3]-u[1]))/(innerWidth*innerHeight)).toFixed(3), hand: hand && r(hand), cards: [...document.querySelectorAll('.table-hand .action-item')].map(e=>e.offsetHeight), scroll: document.scrollingElement.scrollHeight - innerHeight }
  })))
  await p.screenshot({ path: `${out}/${tag}-${n}.png` })
  await p.locator('.table-hand .action-item').nth(3).hover()
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${out}/${tag}-${n}-hover.png`, clip: { x: 300, y: h - 240, width: w - 300, height: 240 } })
  await p.mouse.move(5, 5)
  await p.keyboard.press('Tab')
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!document.activeElement?.closest('.table-hand'))); i++) await p.keyboard.press('Tab')
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${out}/${tag}-${n}-focus.png`, clip: { x: 300, y: h - 240, width: w - 300, height: 240 } })
  await p.context().close()
}
await b.close()
