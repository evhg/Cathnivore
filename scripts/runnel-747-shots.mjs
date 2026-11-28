import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const out = process.argv[2]
for (const [n, vp, sch, sky] of [['P-dark-clouds', { width: 390, height: 844 }, 'dark', 'morning,clouds'], ['P-light', { width: 390, height: 844 }, 'light', 'noon,clear'], ['D-light', { width: 1440, height: 900 }, 'light', 'noon,clear'], ['D-dark', { width: 1440, height: 900 }, 'dark', 'dusk,clear']]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: sch, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.clock.setFixedTime(new Date('2026-11-17T10:00:00Z'))
  await page.goto(`http://localhost:4175/runnel/?nohelp&sky=${sky}`)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/${n}.png` })
  if (n === 'P-dark-clouds') await page.screenshot({ path: `${out}/${n}-zoom.png`, clip: { x: 100, y: 300, width: 120, height: 120 } })
  await ctx.close()
}
await b.close()
