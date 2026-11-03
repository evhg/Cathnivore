// Plan item 55: the board mid-game on each map (ring, coast, delta) at P and D, light, dark and greyscale, after an
// autoplayed Quick Game stops at ROUND (default 6), into OUT (default e2e/screenshots/board55) as
// <tag>-<map>-r<round>-<scheme>-<size>.png. MAPS, SCHEMES and SIZES narrow it.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-board-shots.mjs [tag]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATH_URL ?? 'http://localhost:4191/'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/board55'
const round = Number(process.env.ROUND ?? 6)
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const SIZES = { P: [390, 844, true], D: [1440, 900, false] }
for (const map of (process.env.MAPS ?? 'ring').split(','))
  for (const scheme of (process.env.SCHEMES ?? 'light').split(','))
    for (const n of (process.env.SIZES ?? 'P,D').split(',')) {
      const [w, h, touch] = SIZES[n]
      const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme === 'dark' ? 'dark' : 'light' })
      const p = await ctx.newPage()
      await p.goto(`${base}?e2eAutoplay=1&e2eAutoplayUntil=${round}`)
      await p.getByText('Quick Game').click()
      if (map !== 'ring') await p.locator(`[data-layout="${map}"], [data-map="${map}"]`).first().click().catch(() => {})
      await p.getByRole('button', { name: 'Start' }).click()
      for (let i = 0; i < 120; i++) {
        const r = await p.evaluate(() => Number(document.querySelector('svg.map[data-round]')?.getAttribute('data-round') ?? 0))
        if (r >= round) break
        await p.waitForTimeout(500)
      }
      await p.waitForTimeout(2500)
      if (scheme === 'grey') await p.addStyleTag({ content: 'html { filter: grayscale(100%); }' })
      const at = await p.evaluate(() => Number(document.querySelector('svg.map[data-round]')?.getAttribute('data-round') ?? 0))
      await p.screenshot({ path: `${out}/${tag}-${map}-r${at}-${scheme}-${n}.png` })
      console.log(tag, map, at, scheme, n)
      await ctx.close()
    }
await b.close()
