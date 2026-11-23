// Plan item 670: Runnel's desktop rail before and after a solve at 1440x900 and 1280x800: the largest empty band in
// the rail (no element painted), and the rail's figure stamps. OUT=dir node scripts/runnel-670-shots.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after', out = process.env.OUT ?? 'e2e/screenshots/r670'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [w, h] of [[1440, 900], [1280, 800]]) for (const win of [false, true]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.goto('http://localhost:4175/runnel/')
  await p.evaluate(() => localStorage.setItem('runnel:v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('runnel:v1') ?? '{}'), version: 1, climbDone: true, seenHelp: true })))
  await p.goto(`http://localhost:4175/runnel/?nohelp${win ? '&shotwin' : ''}`); await p.waitForTimeout(win ? 5000 : 2000)
  const m = await p.evaluate(() => {
    const rail = document.querySelector('.rail')?.getBoundingClientRect()
    if (!rail) return null
    // rows of the rail with no visible element over them (beyond the rail's own box)
    let run = 0, best = 0
    for (let y = rail.top; y < Math.min(rail.bottom, innerHeight); y += 4) {
      let hit = false
      for (let x = rail.left + 8; x < rail.right - 8; x += 8) {
        const e = document.elementFromPoint(x, y)
        if (e && !e.matches('.rail, .app, body, html, main, .rail-body') && e.closest('.rail')) { hit = true; break }
      }
      run = hit ? 0 : run + 4; best = Math.max(best, run)
    }
    return { rail: [rail.left, rail.top, rail.right, rail.bottom].map(Math.round), emptyBand: best }
  })
  console.log(w, win ? 'solved' : 'fresh', JSON.stringify(m))
  await p.screenshot({ path: `${out}/${tag}-${w}-${win ? 'solved' : 'fresh'}.png` })
  await p.close()
}
await b.close()
