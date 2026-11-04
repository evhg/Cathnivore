// Plan item 131: the phone game table (390x844 and 375x667, light and dark): the hexes' share of the map frame's
// width, Cath at the table and whether she meets a hex or a name plate, and the page's scroll.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-131-shots.mjs http://localhost:4191 <tag>
import { chromium } from '@playwright/test'
const [base, tag] = [process.argv[2], process.argv[3]]
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const scheme of (process.env.SCHEMES ?? 'light,dark').split(','))
for (const [n, w, h] of [['P', 390, 844], ['P667', 375, 667]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, colorScheme: scheme })).newPage()
  await p.goto(base + '/')
  await p.getByText('Quick Game').click()
  await p.locator('.setup-start').click()
  await p.locator('.game').waitFor()
  await p.waitForTimeout(1500)
  console.log(n, scheme, JSON.stringify(await p.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    const q = (s) => r(document.querySelector(s))
    const hexes = [...document.querySelectorAll('.map svg polygon, .map svg path.hex, [data-region] polygon')].map(r).filter(Boolean)
    const hx = hexes.length ? [Math.min(...hexes.map((x) => x[0])), Math.min(...hexes.map((x) => x[1])), Math.max(...hexes.map((x) => x[2])), Math.max(...hexes.map((x) => x[3]))] : null
    return { frame: q('.map-wrap'), hexes: hx, nHex: hexes.length, cath: q('.table-cath-figure') ?? q('.cath-companion .cameo'), scroll: document.scrollingElement.scrollHeight - innerHeight }
  })))
  await p.screenshot({ path: `e2e/screenshots/c131/${tag}-${n}-${scheme}.png` })
  await p.context().close()
}
await b.close()
