// Plan item 707: Hedgerow 2D convoy shots, l27 mid-wave at P (2x) and D, plus the vehicle rects from field2d().
// Usage: npx vite preview --outDir dist-site --port 4180 &  OUT=<dir> node scripts/hedgerow-707-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'e2e/screenshots/h707'
const levels = (process.env.LEVELS ?? '27').split(',').map(Number)
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, D: { viewport: { width: 1440, height: 900 } } }
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
for (const [s, o] of Object.entries(SIZES))
  for (const level of levels) {
    const ctx = await browser.newContext(o)
    const p = await ctx.newPage()
    await p.goto(`${base}/hedgerow/?sandbox=1&2d`)
    await p.evaluate(([st, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { [l]: true }, tips: t })), [stars, tips, level])
    await p.goto(`${base}/hedgerow/?sandbox=1&2d&level=${level}${process.env.ROUND ? `&round=${process.env.ROUND}` : ''}`)
    await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
    await p.addStyleTag({ content: '#intro { display: none !important; }' })
    await p.evaluate(() => {
      const h = window.hedgerow, g = h.game()
      const path = [...g.level.path, ...(g.level.path2 ?? [])]
      const near = (c, r) => Math.min(...path.map(([pc, pr]) => Math.abs(pc - c) + Math.abs(pr - r)))
      const cover = (c, r) => path.filter(([pc, pr]) => Math.hypot(pc - c, pr - r) <= 2.2).length
      const spots = []
      for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
      spots.sort((a, b) => (a[0] > 1) - (b[0] > 1) || cover(b[1], b[2]) - cover(a[1], a[2]) || a[0] - b[0])
      let n = 0
      for (const [, c, r] of spots) { if (n >= 8) break; if (h.place(g, g.level.towers[n % g.level.towers.length], c, r).ok) n++ }
      h.arm?.(g); h.sendWave(g, true)
    })
    for (const t of (process.env.TIMES ?? '4,9').split(',').map(Number)) {
      const until = Date.now() + t * 1000
      while (Date.now() < until) { await p.waitForTimeout(300); await p.evaluate(() => document.querySelector('.intro:not([hidden]) .intro-go')?.click()) }
      await p.screenshot({ path: `${out}/l${level}-${s}-t${t}.png` })
      if (s === 'P') await p.screenshot({ path: `${out}/l${level}-${s}-t${t}-zoom.png`, clip: { x: 10, y: 240, width: 330, height: 330 } })
      writeFileSync(`${out}/l${level}-${s}-t${t}.json`, JSON.stringify(await p.evaluate(() => ({ f: window.hedgerow.field2d(), kinds: window.hedgerow.game().enemies.map((e) => e.kind) }))))
    }
    await ctx.close()
  }
await browser.close()
