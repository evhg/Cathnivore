// Plan item 62: the farm stall in an autoplayed Quick Game at ROUND (default 5): the phone's Farm sheet and the
// desktop's left column, light and dark, into OUT (default e2e/screenshots/farm62).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.CATH_URL ?? 'http://localhost:4191/'
const out = process.env.OUT ?? 'e2e/screenshots/farm62'
const round = Number(process.env.ROUND ?? 5)
const tag = process.argv[2] ?? 'after'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const scheme of (process.env.SCHEMES ?? 'light').split(','))
  for (const [n, w, h, touch] of [['P', 390, 844, true], ['D', 1440, 900, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme })
    const p = await ctx.newPage()
    await p.goto(`${base}?e2eAutoplay=1&e2eAutoplayUntil=${round}`)
    await p.getByText('Quick Game').click()
    await p.getByRole('button', { name: 'Start' }).click()
    await p.waitForFunction((r) => Number(document.querySelector('svg.map[data-round]')?.getAttribute('data-round') ?? 0) >= r, round, { timeout: 90_000 })
    await p.waitForTimeout(2000)
    if (n === 'P') {
      await p.getByRole('button', { name: /^Farm/ }).first().click()
      await p.waitForTimeout(700)
    }
    await p.screenshot({ path: `${out}/${tag}-r${round}-${scheme}-${n}.png` })
    console.log(tag, round, scheme, n, await p.locator('.stall-item').count())
    await ctx.close()
  }
await b.close()
