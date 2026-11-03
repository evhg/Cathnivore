// The "New on the lane" card on a phone and a desktop, mid-round (critique bug 2026-11-03: it covered the
// field's top on a phone). Usage: npm run build:site && npx vite preview --outDir dist-site --port 4191 &
//   then node scripts/hedgerow-intro-shots.mjs <tag>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] || 'after'
const base = process.env.BASE || 'http://localhost:4191'
const out = 'e2e/screenshots/hedgerow-intro'
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const p = await b.newPage({ viewport: vp })
  const URL = `${base}/hedgerow/?2d&sandbox=1`
  await p.goto(URL)
  await p.evaluate(() => {
    const stars = {}
    for (let i = 1; i < 12; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 12: true }, seen: {}, tips: { all: true } }))
  })
  await p.goto(`${URL}&level=12`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 30000 })
  await p.evaluate(() => { const hg = window.hedgerow; hg.sendWave(hg.game(), true); hg.refresh() })
  await p.locator('#intro').waitFor({ state: 'visible', timeout: 20000 })
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${out}/${n}-${tag}.png` })
  const box = await p.locator('#intro').boundingBox()
  console.log(n, tag, JSON.stringify(box))
  await p.close()
}
await b.close()
