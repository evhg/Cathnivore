// Plan item 153: the Hedgerow journey map's act borders (where one act's ground meets the next), P and D,
// light and dark, from a save part-way through act 2 (act 3 on is in pencil).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/hedgerow-border-shots.mjs
// TAG=before|after names the files; OUT sets the folder.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/b153'
const tag = process.env.TAG ? `-${process.env.TAG}` : ''
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = {}
for (let i = 1; i <= 13; i++) stars[String(i)] = i % 4 === 0 ? 2 : 3
const SIZES = [
  ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }],
  ['D', { viewport: { width: 1440, height: 900 } }],
  ['Pdark', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, colorScheme: 'dark' }],
  ['Ddark', { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }],
]
for (const [name, opts] of SIZES) {
  const page = await browser.newPage(opts)
  await page.goto(base)
  await page.evaluate((s) => {
    const seenBefore = {}
    for (const k of Object.keys(s)) seenBefore[k] = true
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore, seen: {}, tips: {}, bank: {} }))
    localStorage.setItem('hedgerow:fog:v1', '2')
  }, stars)
  await page.reload()
  await page.waitForTimeout(1500)
  for (let i = 0; i < 3; i++) {
    const d = page.locator('dialog[open] button').first()
    if (!(await d.count())) break
    await d.click().catch(() => {})
    await page.waitForTimeout(300)
  }
  await page.screenshot({ path: `${out}/${name}-map${tag}.png` })
  // Each border: the top of act n+1 put at the middle of the screen.
  for (const n of [2, 3, 4]) {
    await page.evaluate((n) => {
      const list = document.querySelector('#levels')
      const act = document.querySelector(`#levels li.act[data-act="${n}"]`)
      if (!list || !act) return
      list.scrollTo({ top: list.scrollTop + act.getBoundingClientRect().top - innerHeight / 2, behavior: 'instant' })
    }, n)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${out}/${name}-border${n - 1}-${n}${tag}.png` })
  }
  await page.close()
}
await browser.close()
