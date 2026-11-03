// Plan item 52: every tower at tier 1 on one field, so their silhouettes can be compared at P and D (2D and 3D),
// plus the tier-1 silhouette masks at 24 px as one strip (sil.png).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/field52 node scripts/hedgerow-tower-lineup.mjs   (SIZES=P,D MODES=2d,3d LEVEL=38)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/field52'
const level = Number(process.env.LEVEL ?? 38)
const sizes = (process.env.SIZES ?? 'P,D').split(',')
const modes = (process.env.MODES ?? '2d,3d').split(',')
const KINDS = ['hedgerow', 'scarecrow', 'beehive', 'stall', 'pond', 'barn', 'silo', 'mast', 'tent', 'court', 'hall', 'windmill', 'cannon']
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], L: [844, 390], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
for (const mode of modes)
  for (const size of sizes) {
    const [w, h] = SIZES[size]
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size !== 'D', isMobile: size !== 'D' })
    const page = await ctx.newPage()
    const url = `${base}?sandbox=1${mode === '2d' ? '&2d' : ''}`
    await page.goto(url)
    await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
    await page.goto(`${url}&level=${level}`)
    await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
    const placed = await page.evaluate((kinds) => {
      const hg = window.hedgerow
      const g = hg.game()
      let k = 0
      for (let r = 0; r < g.level.rows && k < kinds.length; r++)
        for (let c = 0; c < g.level.cols && k < kinds.length; c++) if (hg.place(g, kinds[k], c, r).ok) k++
      hg.refresh()
      return k
    }, KINDS)
    await page.waitForTimeout(mode === '2d' ? 5000 : 8000)
    await page.screenshot({ path: `${out}/towers-${mode}-${size}-L${level}.png` })
    console.log(mode, size, 'placed', placed)
    await ctx.close()
  }
{
  const page = await browser.newPage({ viewport: { width: 1400, height: 140 } })
  await page.goto(`${base}?2d&sandbox=1`)
  await page.waitForFunction(() => !!window.hedgerow?.silhouette)
  await page.evaluate((K) => {
    const c = document.createElement('canvas')
    c.width = 1400
    c.height = 140
    Object.assign(c.style, { position: 'fixed', left: 0, top: 0, zIndex: 99999 })
    document.body.appendChild(c)
    const x = c.getContext('2d')
    x.fillStyle = '#fff'
    x.fillRect(0, 0, 1400, 140)
    K.forEach((k, i) => {
      const s = window.hedgerow.silhouette(k, 24)
      x.fillStyle = '#000'
      for (let j = 0; j < s.mask.length; j++) if (s.mask[j]) x.fillRect(10 + i * 105 + (j % s.w) * 2.5, 10 + Math.floor(j / s.w) * 2.5, 2.5, 2.5)
      x.fillStyle = '#c00'
      x.font = '14px sans-serif'
      x.fillText(k, 10 + i * 105, 120)
    })
  }, KINDS)
  await page.screenshot({ path: `${out}/sil.png`, clip: { x: 0, y: 0, width: 1400, height: 130 } })
}
await browser.close()
