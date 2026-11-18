// Plan item 483: the campaign's departure frozen at 0, 50 and 100% at P and D (light), into OUT.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-483-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const out = process.env.OUT ?? 'e2e/screenshots/t483'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [n, w, h, touch] of [['P', 390, 844, true], ['D', 1440, 900, false]])
  for (const at of [0, 450, 880]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch })
    await ctx.addInitScript(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'] })))
    const p = await ctx.newPage()
    await p.goto('http://localhost:4191/?depart')
    await p.getByRole('button', { name: 'Campaign' }).click()
    await p.locator('.cmp-map-svg').waitFor()
    await p.waitForTimeout(1500)
    // hold the departure's end timer so the frozen frame stays on screen
    await p.evaluate(() => {
      const st = window.setTimeout
      window.setTimeout = ((f, ms, ...a) => (ms === 900 || ms === 200 ? 0 : st(f, ms, ...a)))
    })
    await p.locator('.cmp-stop-next .cmp-card').click()
    await p.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t }), at)
    await p.waitForTimeout(200)
    await p.screenshot({ path: `${out}/depart-${n}-${at}.png` })
    await ctx.close()
  }
await b.close()
