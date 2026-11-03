// Plan item 48: Cathnivore's end screen after an autoplayed Quick Game, at P, D and L (light and dark), into
// OUT (default e2e/screenshots/end48). The autoplay decides win or loss; the file names say which.
//   npm run build && npx vite preview --port 4191 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathnivore-end-shots.mjs [tag]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATH_URL ?? 'http://localhost:4191/'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/end48'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const scheme of (process.env.SCHEMES ?? 'light').split(','))
  for (const [n, w, h, touch] of [['P', 390, 844, true], ['D', 1440, 900, false], ['L', 844, 390, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme })
    const p = await ctx.newPage()
    await p.goto(`${base}?e2eAutoplay=1`)
    if (process.env.CHAPTER) {
      // CHAPTER="Fresh Meat": a campaign chapter's end screen instead of a Quick Game's.
      await p.getByRole('button', { name: 'Campaign' }).click()
      await p.getByRole('button', { name: new RegExp(`^${process.env.CHAPTER}`) }).click()
      const solo = p.getByRole('button', { name: /^Solo/ })
      if (await solo.isVisible().catch(() => false)) await solo.click()
      await p.locator('.scene').waitFor({ timeout: 30_000 })
      await p.getByRole('button', { name: 'Continue' }).click()
    } else {
      await p.getByText('Quick Game').click()
      await p.getByRole('button', { name: 'Start' }).click()
    }
    await p.locator('.end-screen').waitFor({ timeout: 60_000 })
    await p.waitForTimeout(Number(process.env.WAIT ?? 3500))
    const won = await p.locator('.end-screen.is-win').count()
    await p.screenshot({ path: `${out}/${tag}-${process.env.CHAPTER ? 'chapter-' : ''}${won ? 'win' : 'loss'}-${scheme}-${n}.png` })
    console.log(tag, scheme, n, won ? 'win' : 'loss')
    await ctx.close()
  }
await b.close()
