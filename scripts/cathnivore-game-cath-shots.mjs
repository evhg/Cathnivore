// Plan item 75: the game screen's Cath (the companion beside the narration) at P and D, light and dark, into
// /tmp/claude-0/b75/<tag>-<size>-<scheme>.png; logs her cameo's size and whether it meets the map or Actions.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-game-cath-shots.mjs http://localhost:4191 <tag>
import { chromium } from '@playwright/test'
const [base, tag] = [process.argv[2], process.argv[3]]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const scheme of (process.env.SCHEMES ?? 'light,dark').split(','))
for (const [n, w, h, touch] of [['P', 390, 844, true], ['D', 1440, 900, false], ['D2', 1280, 800, false]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme })).newPage()
  await p.goto(base + '/')
  await p.getByText('Quick Game').click()
  await p.locator('.setup-start').click()
  await p.locator('.game').waitFor()
  await p.waitForTimeout(1200)
  console.log(n, scheme, JSON.stringify(await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }
    return { cameo: r('.cath-companion .cameo'), aside: r('.cath-companion'), line: r('.cath-companion-line'), scroll: document.scrollingElement.scrollHeight - innerHeight }
  })))
  await p.screenshot({ path: `/tmp/claude-0/b75/${tag}-${n}-${scheme}.png` })
  await p.context().close()
}
await b.close()
