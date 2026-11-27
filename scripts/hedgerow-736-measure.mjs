// Plan item 736: Hedgerow 2D late waves at levels 27 and 34 (sandbox, ?2d), P and D: shots every few seconds of a
// late wave with towers placed along the lane, and the label boxes drawn (gains, text floats) each frame.
// Usage: npx vite preview --outDir dist-site --port 4188 &  OUT=<dir> node scripts/hedgerow-736-measure.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4188'
const out = process.env.OUT ?? 'e2e/screenshots/h736'
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, D: { viewport: { width: 1440, height: 900 } } }
const only = process.env.SIZES?.split(',')
const levels = (process.env.LEVELS ?? '34,27').split(',').map(Number)
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
const report = {}
for (const level of levels)
  for (const [s, o] of Object.entries(SIZES)) {
    if (only && !only.includes(s)) continue
    const ctx = await browser.newContext(o)
    const p = await ctx.newPage()
    await p.goto(`${base}/hedgerow/?sandbox=1&2d`)
    await p.evaluate(([st, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { [l]: true }, seen: {}, tips: t })), [stars, tips, level])
    await p.goto(`${base}/hedgerow/?sandbox=1&2d&level=${level}`)
    await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
    await p.addStyleTag({ content: '#intro { display: none !important; }' })
    await p.evaluate(() => {
      const h = window.hedgerow, g = h.game()
      const path = [...g.level.path, ...(g.level.path2 ?? [])]
      const near = (c, r) => Math.min(...path.map(([pc, pr]) => Math.abs(pc - c) + Math.abs(pr - r)))
      const spots = []
      for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
      spots.sort((a, b) => a[0] - b[0] || a[1] - b[1])
      let n = 0
      for (const [, c, r] of spots) { if (n >= 12) break; if (h.place(g, g.level.towers[n % g.level.towers.length], c, r).ok) n++ }
      h.arm?.(g)
      for (let i = 0; i < 8; i++) h.sendWave(g, true)
    })
    const key = `l${level}-${s}`
    report[key] = []
    for (let t = 1; t <= Number(process.env.FRAMES ?? 6); t++) {
      await p.waitForTimeout(Number(process.env.GAP ?? 2500))
      const info = await p.evaluate(() => {
        const r = window.hedgerow.renderer()
        const c = document.getElementById('canvas').getBoundingClientRect()
        return { redrawn: r.redrawn, canvas: { w: c.width, h: c.height }, gains: r.gainRects?.() ?? [], floats: r.floatRects?.() ?? [], wave: window.hedgerow.game().wave }
      })
      await p.screenshot({ path: `${out}/${key}-f${t}.png` })
      report[key].push(info)
    }
    await ctx.close()
  }
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1))
await browser.close()
