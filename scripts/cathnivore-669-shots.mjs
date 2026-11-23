// Plan item 669: the desktop campaign (Cath's bust, the ticket clear of the names) at D, 1280x800 and P, with
// geometry. node scripts/cathnivore-669-shots.mjs <outdir> <tag>  (a preview on :4191)
import { chromium } from '@playwright/test'
const [out, tag = 'after'] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [vp, w, h] of [['D', 1440, 900], ['D2', 1280, 800], ['P', 390, 844]])
  for (const [save, done] of [['fresh', []], ['mid', ['fresh-meat', 'word-of-mouth', 'growing-season']]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.addInitScript((c) => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: c, tutorialDone: true })), done)
    await p.goto('http://localhost:4191/')
    await p.getByRole('button', { name: 'Campaign' }).click()
    await p.waitForSelector('.cmp-map')
    await p.mouse.move(4, h - 4)
    await p.waitForTimeout(700)
    await p.screenshot({ path: `${out}/${tag}-${save}-${vp}.png` })
    const g = await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round).join(',') }
      return { map: r('.campaign-screen > .cmp-map'), svg: r('.cmp-map-svg'), host: r('.cmp-map-host'), cath: r('.cmp-header-cath'), face: r('.cmp-header-cath .cath-features'), line: r('.cmp-cath-line'), ticket: r('.cmp-ticket'), rail: r('.cmp-chapters, .cmp-list, ol') }
    })
    console.log(tag, save, vp, JSON.stringify(g))
    await ctx.close()
  }
await b.close()
