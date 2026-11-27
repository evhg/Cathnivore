// Plan item 735: Hedgerow's 3D view at P (390x844) and D for LEVELS (default 1,12,27,34): the fitted field's share,
// each depot's projected box and how much of it the canvas holds, and a shot into OUT.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then this.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/h735'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const level of (process.env.LEVELS ?? '1,12,27,34').split(',').map(Number))
  for (const [n, vp] of (process.env.SIZES ?? 'P').split(',').map((k) => [k, k === 'P' ? { width: 390, height: 844 } : { width: 1440, height: 900 }])) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: n === 'P', isMobile: n === 'P' })
    const p = await ctx.newPage()
    await p.goto('http://localhost:4186/hedgerow/?sandbox=1')
    await p.evaluate((l) => {
      const stars = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await p.goto(`http://localhost:4186/hedgerow/?sandbox=1&level=${level}`)
    await p.waitForFunction(() => !!window.hedgerow?.game() && window.hedgerow.fieldShare() !== null, null, { timeout: 90_000 })
    for (let i = 0; i < 40 && !(await p.evaluate(() => window.hedgerow.camSettled())); i++) await p.waitForTimeout(500)
    await p.waitForTimeout(2000)
    const m = await p.evaluate(() => {
      const c = document.querySelector('#canvas').getBoundingClientRect()
      return { canvas: [Math.round(c.width), Math.round(c.height)], share: window.hedgerow.fieldShare(), depots: window.hedgerow.depotFrames() }
    })
    console.log(tag, level, n, JSON.stringify(m))
    await p.screenshot({ path: `${out}/${tag}-l${level}-${n}.png`, timeout: 120_000 })
    await ctx.close()
  }
await b.close()
