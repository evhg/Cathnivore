// Plan item 547: the open act's ground (its --ground image alone) mean HSV saturation per act, and Cath's height at
// 1440x900. Usage: a dist-site preview on :4180 (HEDGEROW_URL overrides), then node scripts/hedgerow-547-measure.mjs
import { chromium } from '@playwright/test'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(base)
const stars = {}
for (let i = 1; i <= 13; i++) stars[String(i)] = 3
await page.evaluate((s) => {
  const seenBefore = {}
  for (const k of Object.keys(s)) seenBefore[k] = true
  localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore, seen: {}, tips: {}, bank: {} }))
  localStorage.setItem('hedgerow:fog:v1', '10')
}, stars)
await page.reload()
await page.waitForTimeout(1500)
const r = await page.evaluate(async () => {
  const out = {}
  for (const act of document.querySelectorAll('#screen-select .act')) {
    const g = act.style.getPropertyValue('--ground')
    const m = g.match(/url\("(.*)"\)/s)
    if (!m) continue
    const img = new Image()
    img.src = m[1]
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 480
    c.height = 240
    const x = c.getContext('2d')
    x.drawImage(img, 0, 0, 480, 240)
    const d = x.getImageData(0, 0, 480, 240).data
    let s = 0
    let l = 0
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2])
      const mn = Math.min(d[i], d[i + 1], d[i + 2])
      s += mx ? (mx - mn) / mx : 0
      l += mx / 255
    }
    const n = d.length / 4
    out[act.querySelector('.act-place')?.textContent ?? '?'] = { sat: +(s / n).toFixed(3), val: +(l / n).toFixed(3), pencil: act.classList.contains('act-pencil') }
  }
  const you = document.querySelector('.node.next .you')?.getBoundingClientRect()
  return { acts: out, cath: you ? Math.round(you.height) : null }
})
console.log(JSON.stringify(r, null, 1))
await browser.close()
