// Plan item 675: Runnel's board at P and D, unsolved and solved, for the dry tiles' mill wheels. OUT=dir node scripts/runnel-675-shots.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'x', out = process.env.OUT ?? 'e2e/screenshots/r675'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [s, o] of [['D', { viewport: { width: 1440, height: 900 } }], ['P', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) for (const win of [false, true]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage()
  await p.goto('http://localhost:4175/runnel/')
  await p.evaluate(() => localStorage.setItem('runnel:v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('runnel:v1') ?? '{}'), version: 1, climbDone: true, seenHelp: true })))
  await p.goto(`http://localhost:4175/runnel/?nohelp${win ? '&shotwin' : ''}`); await p.waitForTimeout(win ? 5000 : 2000)
  const n = await p.evaluate(() => ({ wheels: document.querySelectorAll('.mill-wheel').length, spokes: document.querySelector('.mill-wheel')?.querySelectorAll('.mill-spoke').length ?? 0 }))
  console.log(s, win ? 'solved' : 'fresh', JSON.stringify(n))
  await p.screenshot({ path: `${out}/${tag}-${s}-${win ? 'solved' : 'fresh'}.png` })
  await ctx.close()
}
await b.close()
