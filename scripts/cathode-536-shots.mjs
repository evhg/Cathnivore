// Plan item 536: NIGHT SHIFT's title menu as the morning paper's index, at P and D, plus D with a case open.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-536-shots.mjs <tag>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after'
const base = 'http://localhost:4186/nightshift/'
mkdirSync('e2e/screenshots/menu536', { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const runs = [
  ['P', { width: 390, height: 844 }, false],
  ['D', { width: 1440, height: 900 }, false],
  ['Dsave', { width: 1440, height: 900 }, true],
]
for (const [n, vp, save] of runs) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: n === 'P' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  const p = await ctx.newPage()
  if (save) {
    await p.goto(`${base}?play&class=ghost&rs=0.5`, { timeout: 180000 })
    await p.waitForFunction(() => (window.cathode?.stats.frames ?? 0) >= 2, null, { timeout: 300000 })
    await p.evaluate(() => { window.cathode.progress.jobsDone.push('fishMarket'); window.cathode.progress.save() })
  }
  await p.goto(`${base}?front=title&shot&t=8${n === 'P' ? '&quality=phone' : ''}`, { timeout: 180000 })
  await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
  await p.waitForTimeout(3000)
  console.log(n, JSON.stringify(await p.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round) }
    return { menu: r(document.getElementById('menu')), rows: [...document.querySelectorAll('#menu .menu-item')].map((e) => [e.dataset.slot, e.hidden, ...r(e)]), lit: document.getElementById('menu').dataset.lit }
  })))
  await p.screenshot({ path: `e2e/screenshots/menu536/${tag}-${n}.png`, timeout: 240000 })
  if (n !== 'P') {
    await p.keyboard.press('ArrowDown')
    await p.waitForTimeout(400)
    await p.screenshot({ path: `e2e/screenshots/menu536/${tag}-${n}-down.png`, clip: { x: 0, y: 220, width: 700, height: 380 }, timeout: 240000 })
  }
  await ctx.close()
}
await b.close()
