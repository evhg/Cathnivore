// Plan item 18: the Hedgerow campaign map at P, D, L and dark, from a save part-way through act 2.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/hedgerow-map-shots.mjs
// FRESH=1 shoots a new profile instead; TAG=before|after names the files.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots'
const tag = process.env.TAG ? `-${process.env.TAG}` : ''
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = {}
if (!process.env.FRESH) for (let i = 1; i <= 13; i++) stars[String(i)] = i % 4 === 0 ? 2 : 3
const seen = {}
for (const k of ['hedgerow-intro', 'intro', 'how']) seen[k] = true
const SIZES = [
  ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }],
  ['D', { viewport: { width: 1440, height: 900 } }],
  ['L', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }],
  ['dark', { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }],
]
const report = {}
for (const [name, opts] of SIZES) {
  const page = await browser.newPage(opts)
  await page.goto(base)
  await page.evaluate(([s, reveal]) => {
    const seenBefore = {}
    for (const k of Object.keys(s)) seenBefore[k] = true
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore, seen: {}, tips: {}, bank: {} }))
    // The fog has already rolled back off every open act (a REVEAL=1 run shoots it mid-roll instead).
    if (!reveal) localStorage.setItem('hedgerow:fog:v1', String(Math.max(1, Math.ceil((Object.keys(s).length + 1) / 10))))
  }, [stars, !!process.env.REVEAL])
  await page.reload()
  await page.waitForTimeout(1500)
  // Close any first-visit sheet that covers the map.
  for (let i = 0; i < 3; i++) {
    const d = page.locator('dialog[open] button').first()
    if (!(await d.count())) break
    await d.click().catch(() => {})
    await page.waitForTimeout(300)
  }
  await page.screenshot({ path: `${out}/${name}-hedgerow-map${tag}.png` })
  report[name] = await page.evaluate(() => {
    const m = document.querySelector('#levels')
    const r = m?.getBoundingClientRect()
    const vis = r ? Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left)) * Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) : 0
    return { mapShare: Math.round((vis / (innerWidth * innerHeight)) * 100) }
  })
  await page.close()
}
console.log(JSON.stringify(report))
await browser.close()
