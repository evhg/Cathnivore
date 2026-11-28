// Plan item 750: Runnel's phone foot (the almanac strip) for a first-time and a returning player (four dailies kept),
// at P (390x844, 2x) and D. Usage: npx vite preview --outDir dist-site --port 4186 &  OUT=<dir> node scripts/runnel-750-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4186'
const out = process.env.OUT ?? 'e2e/screenshots/r750'
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, D: { viewport: { width: 1440, height: 900 } } }
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
for (const [s, o] of Object.entries(SIZES))
  for (const who of ['new', 'back']) {
    const ctx = await browser.newContext(o)
    const p = await ctx.newPage()
    await p.goto(`${base}/runnel/`)
    const results = who === 'back' ? Object.fromEntries([1, 2, 3, 4].map((n) => [day(n), { timeMs: 90_000 + n * 1000, taps: 40, par: 45 }])) : {}
    await p.evaluate((r) => localStorage.setItem('runnel:v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('runnel:v1') ?? '{}'), version: 1, climbDone: true, seenHelp: true, results: r })), results)
    await p.goto(`${base}/runnel/`)
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/runnel-${who}-${s}.png` })
    console.log(s, who, JSON.stringify(await p.evaluate(() => {
      const r = (q) => { const b = document.querySelector(q)?.getBoundingClientRect(); return b && b.height ? [Math.round(b.top), Math.round(b.bottom)] : null }
      return { board: r('.board-wrap, #board'), strip: r('#phone-almanac'), hint: r('#hint'), say: r('#valley-say'), vh: innerHeight, scroll: document.scrollingElement.scrollHeight }
    })))
    await ctx.close()
  }
await browser.close()
