// Plan item 27: every act's opening scene at P, D and L (line 1, plus the second speaker's line where there is one).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/hedgerow-story-shots.mjs
// TAG=before|after names the files; ACTS=1,4 limits the acts.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/story'
const tag = process.env.TAG ? `-${process.env.TAG}` : ''
const acts = (process.env.ACTS ?? '1,2,3,4,5,6,7,8,9,10').split(',').map(Number)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = [
  ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }],
  ['D', { viewport: { width: 1440, height: 900 } }],
  ['L', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }],
]
for (const [name, opts] of SIZES) {
  const page = await browser.newPage({ ...opts, reducedMotion: 'reduce' })
  await page.goto(`${base}?2d&sandbox=1`)
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 1: true }, seen: { 'hedgerow-intro': true, intro: true, how: true }, tips: {}, bank: {} })))
  await page.reload()
  await page.waitForTimeout(1200)
  for (const act of acts) {
    await page.evaluate((id) => {
      document.querySelectorAll('dialog[open]').forEach((d) => d.close())
      window.hedgerow.story(id)
    }, (act - 1) * 10 + 1)
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/story-act${act}-${name}${tag}.png` })
    await page.locator('#story-next').click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/story-act${act}-${name}-2${tag}.png` })
  }
  await page.close()
}
await browser.close()
console.log('shots in', out)
