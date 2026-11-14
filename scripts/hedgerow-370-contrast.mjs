// Plan item 370: lane-to-bed luminance contrast on a 2D level at 1440x900, at 6 lane cells spread along the path,
// each against the free plot beside it (WCAG-style ratio of mean relative luminance over a patch of each cell).
// Usage: a dist-site preview on :4180, then LEVELS=21,25,34 node scripts/hedgerow-370-contrast.mjs
import { chromium } from '@playwright/test'
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const level of (process.env.LEVELS ?? '21,25,34').split(',').map(Number)) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:4180/hedgerow/?sandbox=1&2d')
  await page.evaluate((l) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: l - 1 }, (_, i) => [String(i + 1), 3])), seenBefore: { [l]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })), level)
  await page.goto(`http://localhost:4180/hedgerow/?sandbox=1&2d&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await page.waitForTimeout(6000)
  const pairs = await page.evaluate(() => {
    const lv = window.hedgerow.game().level
    const lane = new Set()
    const cells = []
    for (const p of [lv.path, lv.path2].filter(Boolean)) for (let i = 1; i < p.length; i++) {
      const [a, b] = [p[i - 1], p[i]]
      const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
      for (let k = 0; k <= n; k++) { const c = [a[0] + Math.sign(b[0] - a[0]) * k, a[1] + Math.sign(b[1] - a[1]) * k]; if (!lane.has(c.join())) { lane.add(c.join()); cells.push(c) } }
    }
    const busy = new Set([...(lv.barns ?? []), ...(lv.oaks ?? []), ...(lv.terrain?.water ?? [])].map((c) => c.join()))
    const out = []
    for (const [c, r] of cells) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = [c + dc, r + dr]
        if (n[0] < 0 || n[1] < 0 || n[0] >= lv.cols || n[1] >= lv.rows || lane.has(n.join()) || busy.has(n.join())) continue
        out.push({ lane: window.hedgerow.cellCenter(c, r), bed: window.hedgerow.cellCenter(n[0], n[1]), size: window.hedgerow.cellCenter(1, 0).x - window.hedgerow.cellCenter(0, 0).x })
        break
      }
    }
    return out
  })
  const pick = Array.from({ length: 6 }, (_, i) => pairs[Math.floor(((i + 0.5) / 6) * pairs.length)])
  const buf = await page.screenshot()
  const res = await page.evaluate(async ([b, pick]) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b}`)).blob())
    const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const patch = (p, half) => { const d = x.getImageData(Math.round(p.x - half), Math.round(p.y - half), Math.round(half * 2), Math.round(half * 2)).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) { s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); n++ } return s / n }
    const rgb = (p, half) => { const d = x.getImageData(Math.round(p.x - half), Math.round(p.y - half), Math.round(half * 2), Math.round(half * 2)).data; const s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k] / (d.length / 4); return s.map(Math.round).join("/") }
    return pick.map((p) => { const a = patch(p.lane, p.size * 0.3), bb = patch(p.bed, p.size * 0.3); return { r: +((Math.max(a, bb) + 0.05) / (Math.min(a, bb) + 0.05)).toFixed(2), lane: rgb(p.lane, p.size * 0.3), bed: rgb(p.bed, p.size * 0.3), at: [Math.round(p.bed.x), Math.round(p.bed.y)] } })
  }, [buf.toString('base64'), pick])
  console.log(level, 'min', Math.min(...res.map((r) => r.r)), JSON.stringify(res))
  await page.close()
}
await browser.close()
