// Plan item 695: does each region name fit its plate on the board (D), and where is its status disc?
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' })).newPage()
await p.goto(`${process.env.BASE ?? 'http://localhost:4180'}/cathnivore/?keyart&e2eAutoplay=1&e2eAutoplayUntil=${process.env.UNTIL ?? 3}`)
await p.getByText('Quick Game').click()
await p.getByRole('button', { name: 'Start' }).click()
await p.waitForTimeout(Number(process.env.WAIT ?? 6000))
const m = await p.evaluate(() => [...document.querySelectorAll('.map .region-sign')].map((s) => {
  const t = s.querySelector('.region-name').getBoundingClientRect(), pl = s.querySelector('.region-plaque').getBoundingClientRect()
  const d = s.querySelector('.region-status')?.getBoundingClientRect()
  return `${s.querySelector('.region-name').textContent.padEnd(14)} text ${t.left|0}-${t.right|0} plate ${pl.left|0}-${pl.right|0}` + (d ? ` disc ${d.left|0}-${d.right|0}` : '')
}))
console.log(m.join('\n'))
if (process.env.OUT) await p.screenshot({ path: process.env.OUT })
await b.close()
