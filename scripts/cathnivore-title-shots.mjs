// Plan item 60: the Cathnivore title on the real table, fresh, mid-campaign (chapter 1 won) and complete, at P, L
// and D, light and dark, into OUT (default e2e/screenshots/title60).
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-title-shots.mjs [tag]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATH_URL ?? 'http://localhost:4191/'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/title60'
mkdirSync(out, { recursive: true })
const SAVES = {
  fresh: [],
  mid: ['fresh-meat', 'word-of-mouth'],
  complete: ['fresh-meat', 'word-of-mouth', 'growing-season', 'the-plan', 'friends-in-low-places', 'kingsmarket'],
}
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [save, done] of Object.entries(SAVES).filter(([k]) => !process.env.SAVES || process.env.SAVES.split(',').includes(k)))
  for (const scheme of (process.env.SCHEMES ?? 'light').split(','))
    for (const [n, w, h, touch] of [['P', 390, 844, true], ['L', 844, 390, true], ['D', 1440, 900, false]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme })
      await ctx.addInitScript((c) => {
        if (c.length) localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: c }))
      }, done)
      const p = await ctx.newPage()
      await p.goto(base)
      await p.waitForTimeout(2500)
      await p.screenshot({ path: `${out}/${tag}-${save}-${scheme}-${n}.png` })
      console.log(tag, save, scheme, n, await p.evaluate(() => document.querySelector('.title-table')?.getAttribute('data-free')))
      await ctx.close()
    }
await b.close()
