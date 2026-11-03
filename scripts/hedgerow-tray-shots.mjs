// Plan item 69: the tower tray at D and P before a round of level 12 (2D), into /tmp/claude-0/b69/tray-<tag>-<size>.png,
// and the tray's cards' boxes against the tray's (a card cut by the edge or under the more-tab is logged).
//   node scripts/hedgerow-tray-shots.mjs http://localhost:<port> <tag> [level]
import { chromium } from '@playwright/test'
const [base, tag, lvl = '12'] = [process.argv[2], process.argv[3], process.argv[4]]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const [n, w, h, touch] of [['D', 1440, 900, false], ['D2', 1280, 800, false], ['P', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch })
  const p = await ctx.newPage()
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await p.goto(`${base}/hedgerow/?sandbox=1&2d`)
  await p.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars, tips, lvl])
  await p.goto(`${base}/hedgerow/?sandbox=1&2d&level=${lvl}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await p.addStyleTag({ content: '#intro { display: none !important; }' })
  await p.waitForTimeout(1200)
  const boxes = await p.evaluate(() => {
    const t = document.querySelector('.tray').getBoundingClientRect()
    const more = document.querySelector('.tray-more:not([hidden])')?.getBoundingClientRect()
    return { tray: [t.left, t.right], more: more ? [more.left, more.right] : null, cards: [...document.querySelectorAll('.tray-tower')].map((c) => { const r = c.getBoundingClientRect(); const nm = c.querySelector('.tray-name'); return [nm?.textContent, Math.round(r.left), Math.round(r.right), nm ? nm.scrollWidth > nm.clientWidth : false] }) }
  })
  console.log(n, JSON.stringify(boxes))
  await p.screenshot({ path: `/tmp/claude-0/b69/tray-${tag}-${n}.png` })
  await ctx.close()
}
await b.close()
