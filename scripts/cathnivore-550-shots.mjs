// Plan item 550: the board at round 1 and round 7, P and D, plus a glyph census per hex.
// Usage: npm run build && npx vite preview --port 4190 & OUT=dir node scripts/cathnivore-550-shots.mjs
import { chromium } from '@playwright/test'
const out = process.env.OUT, base = 'http://localhost:4190'
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const census = () => [...document.querySelectorAll('.map-wrap svg.map .region-hex')].map((hex) => {
  const glyphs = [...hex.querySelectorAll('.piece-slot, .grip-props > g, .piece-count')].map((g) => { const b = g.getBoundingClientRect(); return `${g.getAttribute('class')}:${Math.round(b.width)}x${Math.round(b.height)}` })
  return `${hex.getAttribute('aria-label')?.slice(0, 40)} | ${glyphs.join(' ')}`
})
for (const [s, opt] of Object.entries({ D: { viewport: { width: 1440, height: 900 } }, P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } })) {
  for (const round of [1, 7]) {
    const ctx = await browser.newContext(opt); const p = await ctx.newPage()
    await p.goto(round === 1 ? `${base}/` : `${base}/?e2eAutoplay=1&e2eAutoplayUntil=${round}`); await p.waitForTimeout(1200)
    await p.getByText('Quick Game').click(); await p.waitForTimeout(600)
    await p.getByRole('button', { name: 'Start' }).click()
    if (round > 1) await p.waitForFunction((r) => Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0) >= r || !!document.querySelector('.end-screen'), round, { timeout: 90000 })
    if (s === 'D') await p.mouse.move(2, 2)
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/board-r${round}-${s}.png` })
    const map = p.locator('.map-wrap svg.map').first()
    if (await map.count()) await map.screenshot({ path: `${out}/map-r${round}-${s}.png` }).catch(() => {})
    console.log(s, round, '\n' + (await p.evaluate(census)).join('\n'))
    await ctx.close()
  }
}
await browser.close()
