// Plan item 733: Hollowell's Outlet/Buyout pieces' drawn size on the board at P and D after an autoplayed Quick Game
// stops at ROUND, and a shot of each into OUT.  npm run build && npx vite preview --port 4191 &  then this.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATH_URL ?? 'http://localhost:4191/'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/s733'
const round = Number(process.env.ROUND ?? 6)
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: [390, 844, true], D: [1440, 900, false] }
for (const n of (process.env.SIZES ?? 'P,D').split(',')) {
  const [w, h, touch] = SIZES[n]
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, deviceScaleFactor: 2, colorScheme: process.env.SCHEME === 'dark' ? 'dark' : 'light' })
  const p = await ctx.newPage()
  await p.goto(`${base}?e2eAutoplay=1&e2eAutoplayUntil=${round}`)
  await p.getByText('Quick Game').click()
  await p.getByRole('button', { name: 'Start' }).click()
  for (let i = 0; i < 120; i++) {
    const r = await p.evaluate(() => Number(document.querySelector('svg.map[data-round]')?.getAttribute('data-round') ?? 0))
    if (r >= round) break
    await p.waitForTimeout(500)
  }
  await p.waitForTimeout(2500)
  const m = await p.evaluate(() => {
    const boxes = (sel) => [...document.querySelectorAll(`svg.map ${sel}`)].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.x), Math.round(r.y)] })
    const regions = [...document.querySelectorAll('svg.map [data-enemy-pieces]')].map((g) => g.getAttribute('data-region') + ':' + g.getAttribute('data-enemy-pieces'))
    return { outlets: boxes('.enemy-outlet'), buyouts: boxes('.enemy-buyout'), regions, wash: [...document.querySelectorAll('svg.map [data-corp-wash]')].map((e) => e.getAttribute('data-corp-wash')) }
  })
  console.log(tag, n, JSON.stringify(m))
  await p.screenshot({ path: `${out}/${tag}-${n}.png` })
  await p.locator('svg.map').first().screenshot({ path: `${out}/${tag}-${n}-board.png` })
  await ctx.close()
}
await b.close()
