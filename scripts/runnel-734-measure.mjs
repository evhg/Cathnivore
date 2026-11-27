// Plan item 734: Runnel's phone board measured at 390x844 (3x): the channel's drawn width in CSS px, the board's
// render path, and a 3x crop of the board into OUT.  npm run build:site && npx vite preview --outDir dist-site --port 4186 &
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/r734'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, vp, dpr] of [['P', { width: 390, height: 844 }, 3], ['D', { width: 1440, height: 900 }, 1]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, reducedMotion: 'reduce', hasTouch: n === 'P' })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4186/runnel/?nohelp&sky=noon')
  await p.waitForTimeout(1200)
  const m = await p.evaluate(() => {
    const g = document.querySelector('.groove')
    const svg = g?.ownerSVGElement
    const k = svg ? svg.getScreenCTM().a : 0
    const sw = (sel) => { const e = document.querySelector(sel); return e ? Math.round(parseFloat(getComputedStyle(e).strokeWidth) * k * 10) / 10 : null }
    return { canvases: document.querySelectorAll('canvas').length, svgScale: Math.round(k * 1000) / 1000, groove: sw('.groove'), lip: sw('.groove-lip'), cut: sw('.groove-cut'), bed: sw('.groove-bed'), grooveColor: g && getComputedStyle(g).stroke, cutColor: getComputedStyle(document.querySelector('.groove-cut')).stroke }
  })
  console.log(tag, n, JSON.stringify(m))
  await p.locator('svg').filter({ has: p.locator('.groove') }).first().screenshot({ path: `${out}/${tag}-${n}.png` })
  await ctx.close()
}
await b.close()
