// Plan item 610: the phone campaign header measured: Cath's figure and face, her line, the map, the header back chevron and
// the open chapter's Play. Usage: a preview of `npm run build` on :4191, then  node scripts/cathnivore-610-measure.mjs
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [w, h] of [[390, 844], [375, 667]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })).newPage()
  await p.addInitScript(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth', 'growing-season'], tutorialDone: true })))
  await p.goto('http://localhost:4191/')
  await p.getByRole('button', { name: 'Campaign' }).click()
  await p.waitForSelector('.cmp-map')
  await p.waitForTimeout(800)
  console.log(w, h, JSON.stringify(await p.evaluate(() => {
    const bx = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] }
    const back = document.querySelector('.cmp-header-back')
    return { cath: bx('.cmp-header-cath svg'), face: bx('.cmp-header-cath .cath-features'), line: bx('.cmp-cath-line'), map: bx('.campaign-screen > .cmp-map'), back: bx('.cmp-header-back'), backBg: back && getComputedStyle(back).backgroundColor + ' ' + getComputedStyle(back).boxShadow, kicker: bx('.cmp-kicker'), play: [...document.querySelectorAll('.cmp-stop.is-open button')].filter((e) => /Play|Start|Continue/.test(e.textContent)).map((e) => Math.round(e.getBoundingClientRect().bottom)), scroll: document.scrollingElement.scrollHeight - innerHeight }
  })))
}
await b.close()
