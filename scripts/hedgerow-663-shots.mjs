// Plan item 663: the Hedgerow act map at P and D, with Cath's token size and stop states.
// Needs a dist-site preview on :4180. N=<levels cleared> OUT=<dir> node scripts/hedgerow-663-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const out = process.env.OUT ?? 'e2e/screenshots/h663'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 1 + (i % 3)]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, D: { viewport: { width: 1440, height: 900 } } }
for (const [s, opts] of Object.entries(SIZES)) {
  const p = await b.newPage(opts)
  await p.goto('http://localhost:4180/hedgerow/?2d')
  await p.evaluate(([st, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 21: true }, tips: t })), [stars(Number(process.env.N ?? 20)), tips])
  await p.goto('http://localhost:4180/hedgerow/'); await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/menu-${s}.png` })
  console.log(s, JSON.stringify(await p.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] }
    return { you: r(document.querySelector('.node.next .you')), coin: r(document.querySelector('.node.next .level-num')), nodes: document.querySelectorAll('.node').length }
  })))
}
await b.close()
