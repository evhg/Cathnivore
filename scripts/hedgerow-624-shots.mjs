// Plan item 624: Hedgerow's act map with its level card, P and D, with the card's measures.
// OUT=dir node scripts/hedgerow-624-shots.mjs [tag] [level-count]  (a dist-site preview on :4175)
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const out = (process.env.OUT ?? 'e2e/screenshots/h624') + '/'
const won = Number(process.argv[3] ?? 20)
const stars = Object.fromEntries(Array.from({ length: won }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.addInitScript(([st, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { [l]: true }, tips: t })), [stars, tips, won + 1])
  await p.goto('http://localhost:4175/hedgerow/?2d')
  await p.waitForTimeout(2500)
  if (n === 'P' && !process.env.CLOSED) { await p.locator('.lcard-grip').click().catch(() => {}); await p.waitForTimeout(600) }
  await p.screenshot({ path: `${out}${tag}-${n}.png` })
  const m = await p.evaluate(() => {
    const r = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] }
    const c = document.querySelector('.level-card')
    return { card: r(c), cath: r(c?.querySelector('.lcard-cath-face')), fig: r(c?.querySelector('.lcard-cath-fig')), mood: c?.querySelector('.lcard-cath')?.dataset.expression, say: r(c?.querySelector('.lcard-cath p')), foes: [...(c?.querySelectorAll('.lcard-enemies .enemy-portrait') ?? [])].map(r), play: r(c?.querySelector('.lcard-play')) }
  })
  console.log(tag, n, JSON.stringify(m))
  await ctx.close()
}
await b.close()
