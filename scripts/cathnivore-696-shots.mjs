// Plan item 696: the desktop campaign's tickets with Cath in her own column. node scripts/cathnivore-696-shots.mjs <out-prefix> [port]
import { chromium } from '@playwright/test'
const [out, port='4191'] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [w,h] of [[1440,900],[1280,800]]) {
const p = await (await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })).newPage()
await p.addInitScript(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })))
await p.goto(`http://localhost:${port}/`)
await p.getByRole('button', { name: 'Campaign' }).click()
for (const id of ['word-of-mouth','growing-season','fresh-meat','kingsmarket']) {
await p.locator(`.cmp-pin[data-chapter="${id}"] .cmp-pin-disc`).hover()
await p.waitForTimeout(500); await p.mouse.move(4, h - 4)
console.log(w, id, await p.evaluate(() => { const r = (s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b && [b.left,b.top,b.right,b.bottom].map(Math.round).join(',') }; return {t: r('.cmp-ticket'), play: r('.cmp-ticket-play'), sheet: r('.campaign-screen > .cmp-map .cmp-sheet')} }))
await p.screenshot({ path: `${out}-${w}-${id}.png` })
}}
await b.close()
