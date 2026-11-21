// Plan item 608: the phone act map's trail, measured. For the act holding the next stop: how much of the lane
// between each pair of consecutive stops shows (not under a sign, stars, medals or another coin), each sign's
// distance from the screen's edges and whether any two signs meet, and Cath's drawn height against a coin's.
// Usage: a dist-site preview on :4180, then  node scripts/hedgerow-608-measure.mjs  (WON=n stops won, default 13)
import { chromium } from '@playwright/test'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const won = Number(process.env.WON ?? 13)
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 390), height: Number(process.env.H ?? 844) }, hasTouch: true, isMobile: true })
await page.goto(base)
await page.evaluate((n) => {
  const stars = {}
  for (let i = 1; i <= n; i++) stars[String(i)] = 3
  const seenBefore = {}
  for (const k of Object.keys(stars)) seenBefore[k] = true
  localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: {}, bank: {} }))
  localStorage.setItem('hedgerow:fog:v1', String(Math.max(1, Math.ceil((n + 1) / 10))))
}, won)
await page.reload()
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(1800)
const r = await page.evaluate(() => {
  const act = [...document.querySelectorAll('li.act')].find((l) => l.querySelector('.node.next'))
  const trail = act.querySelector('.trail')
  const coins = [...trail.querySelectorAll('.stop .level-num')].map((c) => c.getBoundingClientRect())
  const signs = [...trail.querySelectorAll('.stop .level-name')].map((c) => c.getBoundingClientRect())
  const extras = [...trail.querySelectorAll('.stop .level-stars, .stop .level-medals')].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0)
  const blocks = [...signs, ...extras]
  const lane = trail.querySelector('.trail-path path.lane, .trail-path path')
  const paths = [...trail.querySelectorAll('.trail-path path')].filter((p) => !(p.getAttribute('class') ?? '').startsWith('foot-'))
  const path = paths.sort((a, b) => b.getTotalLength() - a.getTotalLength())[0]
  const m = path.getScreenCTM()
  const len = path.getTotalLength()
  const centre = (b) => [b.left + b.width / 2, b.top + b.height / 2]
  const inside = (p, b, pad = 0) => p.x > b.left - pad && p.x < b.right + pad && p.y > b.top - pad && p.y < b.bottom + pad
  const pairs = []
  for (let i = 0; i + 1 < coins.length; i++) {
    const [ay, by] = [centre(coins[i])[1], centre(coins[i + 1])[1]]
    let n = 0
    let hid = 0
    for (let s = 0; s <= len; s += 2) {
      const p = path.getPointAtLength(s).matrixTransform(m)
      if (p.y <= ay || p.y >= by) continue
      if (inside(p, coins[i]) || inside(p, coins[i + 1])) continue
      n++
      if (blocks.some((b) => inside(p, b)) || coins.some((c, j) => j !== i && j !== i + 1 && inside(p, c))) hid++
    }
    pairs.push({ from: i, shown: n ? Math.round(((n - hid) / n) * 100) : 0, n })
  }
  const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const signMeets = signs.some((a, i) => signs.some((b, j) => j > i && meet(a, b)))
  const edge = Math.min(...signs.map((s) => Math.min(s.left, innerWidth - s.right)))
  const you = document.querySelector('#screen-select .node.next .you svg') ?? document.querySelector('#screen-select .node.next .you')
  const yb = you.getBoundingClientRect()
  const coin = document.querySelector('#screen-select .node.next .level-num').getBoundingClientRect()
  return { pairs, signMeets, edge: Math.round(edge), you: Math.round(yb.height), coin: Math.round(coin.height), ratio: +(yb.height / coin.height).toFixed(2), actH: Math.round(trail.getBoundingClientRect().height) }
})
console.log(JSON.stringify(r))
await browser.close()
