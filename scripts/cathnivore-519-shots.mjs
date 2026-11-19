// Plan item 519: the phone game screen (the board's share, the hand, Cath's reaction bust) at P, 375x667 and D,
// into <out>/<tag>-<size>.png; logs the boxes the accept measures.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-519-shots.mjs http://localhost:4191 <out> <tag>
import { chromium } from '@playwright/test'
const [base, out, tag] = [process.argv[2], process.argv[3], process.argv[4]]
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const [n, w, h, touch] of [['P', 390, 844, true], ['S', 375, 667, true], ['D', 1440, 900, false]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 })).newPage()
  await p.goto(base + '/?seed=11')
  await p.getByText('Quick Game').click()
  await p.locator('.setup-start').click()
  await p.locator('.game').waitFor()
  await p.waitForTimeout(1500)
  console.log(n, JSON.stringify(await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    const all = (s) => [...document.querySelectorAll(s)].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] })
    return { mapWrap: r('.map-wrap'), map: r('.map'), market: r('.market-board'), plan: r('.plan-strip'), dock: r('.cath-dock'), companion: r('.cath-companion'), cameo: r('.cath-companion .cameo'), tray: r('.action-tray'), cards: all('.action-tray .hand-card, .action-tray .action-card').slice(0, 8), scroll: document.scrollingElement.scrollHeight - innerHeight }
  })))
  await p.screenshot({ path: `${out}/${tag}-${n}.png` })
  await p.context().close()
}
await b.close()
