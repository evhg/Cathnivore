// Plan item 730: Hedgerow 3D convoy hues at l27's first round (Book round 14, "Convoy"), P and D, in the sandbox.
// For each vehicle on screen, the circular mean hue of its coloured pixels (saturation 0.25+, value 0.15+) inside
// its projected box, grouped by kind, plus how many distinct hue clusters (40 degrees+ apart) the frame holds.
// Usage: npx vite preview --outDir dist-site --port 4188 &  OUT=<dir> node scripts/hedgerow-730-measure.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4188'
const out = process.env.OUT ?? 'e2e/screenshots/h730'
const level = Number(process.env.LEVEL ?? 27)
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, D: { viewport: { width: 1440, height: 900 } } }
const only = process.env.SIZES?.split(',')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
const report = {}
for (const [s, o] of Object.entries(SIZES)) {
  if (only && !only.includes(s)) continue
  const ctx = await browser.newContext(o)
  const p = await ctx.newPage()
  await p.goto(`${base}/hedgerow/?sandbox=1`)
  await p.evaluate(([st, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { [l]: true }, seen: {}, tips: t })), [stars, tips, level])
  await p.goto(`${base}/hedgerow/?sandbox=1&level=${level}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 90000 })
  await p.waitForFunction(() => window.hedgerow.camSettled?.() ?? true, null, { timeout: 90000 })
  await p.addStyleTag({ content: '#intro { display: none !important; }' })
  await p.evaluate((noTowers) => {
    const h = window.hedgerow, g = h.game()
    if (noTowers === 'spawn') {
      // The round's own mix laid along the lane: sealed lorries, Same-Day vans and the pickups they pop into.
      const mix = ['lorry', 'sprinter', 'pickup', 'sprinter', 'lorry', 'van', 'sprinter', 'pickup', 'lorry', 'sprinter', 'hatchback', 'lorry']
      mix.forEach((k, i) => { h.spawn(k, 1.2 + i * 1.6); const e = g.enemies.at(-1); if (k === 'lorry') e.pm |= 8 })
      return
    }
    if (noTowers) { h.sendWave(g, true); return }
    const path = [...g.level.path, ...(g.level.path2 ?? [])]
    const near = (c, r) => Math.min(...path.map(([pc, pr]) => Math.abs(pc - c) + Math.abs(pr - r)))
    const cover = (c, r) => path.filter(([pc, pr]) => Math.hypot(pc - c, pr - r) <= 2.2).length
    const spots = []
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
    spots.sort((a, b) => (a[0] > 1) - (b[0] > 1) || cover(b[1], b[2]) - cover(a[1], a[2]) || a[0] - b[0])
    let n = 0
    for (const [, c, r] of spots) { if (n >= 8) break; if (h.place(g, g.level.towers[n % g.level.towers.length], c, r).ok) n++ }
    h.arm?.(g); h.sendWave(g, true)
  }, process.env.SPAWN ? 'spawn' : !!process.env.NOTOWERS)
  report[s] = []
  for (const t of (process.env.TIMES ?? '6,12').split(',').map(Number)) {
    const until = Date.now() + t * 1000
    while (Date.now() < until) { await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('.intro:not([hidden]) .intro-go')?.click()) }
    await p.evaluate(() => window.hedgerow.freeze?.())
    await p.waitForTimeout(1500)
    await p.evaluate(() => { window.__frozen = true })
    const info = await p.evaluate(() => {
      const h = window.hedgerow, g = h.game()
      const c = document.getElementById('canvas').getBoundingClientRect()
      const all = h.renderer().rungBoxes()
      const meet = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
      // a vehicle whose middle another covers is skipped: its pixels are a neighbour's
      const solo = all.filter((a) => a.x >= 0 && a.y >= 0 && a.x + a.w <= c.width && a.y + a.h <= c.height && all.every((b) => b === a || meet({ x: a.x + a.w * 0.25, y: a.y + a.h * 0.25, w: a.w / 2, h: a.h / 2 }, b) < a.w * a.h * 0.04))
      return { c: { x: c.x, y: c.y }, boxes: solo, kinds: solo.map((b) => b.kind), drawn: all.length, wave: g.wave }
    })
    const png = await p.screenshot({ path: `${out}/l${level}-${s}-t${t}.png` })
    const stats = await p.evaluate(async ({ b64, info }) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const cv = new OffscreenCanvas(img.width, img.height)
      const x = cv.getContext('2d')
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, img.width, img.height).data
      const k = img.width / innerWidth
      const byKind = {}
      const all = []
      info.boxes.forEach((b, i) => {
        const kind = info.kinds[i]
        const x0 = Math.round((info.c.x + b.x + b.w * 0.2) * k), x1 = Math.round((info.c.x + b.x + b.w * 0.8) * k)
        const y0 = Math.round((info.c.y + b.y + b.h * 0.2) * k), y1 = Math.round((info.c.y + b.y + b.h * 0.8) * k)
        if (x0 < 0 || y0 < 0 || x1 > img.width || y1 > img.height || x1 - x0 < 3 || y1 - y0 < 3) return
        let sx = 0, sy = 0, n = 0, tot = 0
        for (let y = y0; y < y1; y++)
          for (let xx = x0; xx < x1; xx++) {
            const o = (y * img.width + xx) * 4
            const r = d[o] / 255, gg = d[o + 1] / 255, bb = d[o + 2] / 255
            const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb)
            tot++
            if (mx < 0.15 || (mx - mn) / mx < 0.25) continue
            let hdeg
            if (mx === r) hdeg = ((gg - bb) / (mx - mn)) % 6
            else if (mx === gg) hdeg = (bb - r) / (mx - mn) + 2
            else hdeg = (r - gg) / (mx - mn) + 4
            hdeg *= 60
            sx += Math.cos((hdeg * Math.PI) / 180); sy += Math.sin((hdeg * Math.PI) / 180); n++
          }
        if (n < tot * 0.15) return
        const hue = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360
        ;(byKind[kind] ??= []).push(hue)
        all.push(hue)
      })
      const mean = (hs) => { let a = 0, c = 0; for (const h of hs) { a += Math.sin((h * Math.PI) / 180); c += Math.cos((h * Math.PI) / 180) } return Math.round(((Math.atan2(a, c) * 180) / Math.PI + 360) % 360) }
      // clusters: greedy, a hue joins the first cluster within 20 degrees of its seed
      const seeds = []
      for (const h of all.sort((a, b) => a - b)) if (!seeds.some((s) => Math.min(Math.abs(s - h), 360 - Math.abs(s - h)) < 40)) seeds.push(h)
      return { kinds: Object.fromEntries(Object.entries(byKind).map(([k, hs]) => [k, { n: hs.length, hue: mean(hs) }])), sampled: all.length, clusters: seeds.map(Math.round) }
    }, { b64: png.toString('base64'), info })
    writeFileSync(`${out}/l${level}-${s}-t${t}.json`, JSON.stringify(info))
    report[s].push({ t, wave: info.wave, drawn: info.drawn, solo: info.kinds.length, ...stats })
    console.log(s, t, JSON.stringify(report[s].at(-1)))
  }
  await ctx.close()
}
writeFileSync(`${out}/report-l${level}.json`, JSON.stringify(report, null, 1))
await browser.close()
