// Plan item 515: the 3D towers' on-screen heights against the farmers' and Cath's. Builds one of each tower the level
// offers (in reading order on the first free plots), lets the camera settle, and prints each tower's height in CSS px
// and as a multiple of the median farmer's (the bar: 1.5x+ at D, 40 px+ at P), with a shot per size.
// Usage: a dist-site preview, then BASE=http://localhost:4186 OUT=<dir> [LEVEL=21] node scripts/hedgerow-515-measure.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4175'
const out = process.env.OUT ?? 'e2e/screenshots/h515'
const level = Number(process.env.LEVEL ?? 21)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [size, w, h] of (process.env.SIZES ?? 'D,P,L').split(',').map((s) => ({ D: ['D', 1440, 900], P: ['P', 390, 844], L: ['L', 844, 390] })[s])) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900, isMobile: w < 900 })
  await page.goto(`${base}/hedgerow/?sandbox=1`)
  await page.evaluate((L) => {
    const stars = {}
    for (let i = 1; i < L; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(L)]: true }, seen: {}, tips: { all: true } }))
  }, level)
  await page.goto(`${base}/hedgerow/?sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
  const kinds = await page.evaluate(() => {
    const hg = window.hedgerow, g = hg.game(), done = []
    for (const k of g.level.towers ?? []) {
      let ok = false
      for (let r = 0; r < g.level.rows && !ok; r++) for (let c = 0; c < g.level.cols && !ok; c++) ok = hg.place(g, k, c, r).ok
      if (ok) done.push(k)
    }
    return done
  })
  await page.waitForTimeout(15000)
  const m = await page.evaluate(() => window.hedgerow.towerHeights())
  const folk = [...(m?.folk ?? [])].sort((a, b) => a - b)
  const farmer = folk.length ? folk[Math.floor(folk.length / 2)] : null
  const fw = [...(m?.folkWorld ?? [])].sort((a, b) => a - b)
  const farmerW = fw.length ? fw[Math.floor(fw.length / 2)] : null
  console.log(size, `farmer ${farmer?.toFixed(0)} px (world ${farmerW?.toFixed(2)}) cath ${m?.cath?.toFixed(0)} px (world ${m?.cathWorld?.toFixed(2)}) built ${kinds.join(',')}`)
  for (const t of m?.towers ?? []) console.log(`  ${t.kind.padEnd(10)} ${t.h.toFixed(0).padStart(4)} px  world ${t.world.toFixed(2)} = ${farmerW ? (t.world / farmerW).toFixed(2) : '-'}x farmer`)
  await page.screenshot({ path: `${out}/towers-${size}.png`, timeout: 120000 })
  // the nine in black fill (scripts/hedgerow-515-masks.py draws them and their pairwise overlap)
  if (size === 'D') writeFileSync(`${out}/masks-${size}.json`, JSON.stringify(await page.evaluate(() => window.hedgerow.towerMasks(48))))
  await page.close()
}
await browser.close()
