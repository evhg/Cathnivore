// Plan item 44: NIGHT SHIFT on a phone held upright (390x844 and 430x932, touch): the upright screen, and the
// case board, wardrobe and gun bench opened from it.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-upright-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['P2', { width: 430, height: 932 }]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('pageerror', String(e)))
  await p.goto((process.env.BASE ?? 'http://localhost:4186') + '/nightshift/?play&class=ghost&quality=phone')
  await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) >= 1, null, { timeout: 240000 })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `e2e/screenshots/upright-${tag}-${n}.png`, timeout: 240000 })
  for (const st of ['board', 'wardrobe', 'bench']) {
    const key = p.locator(`.up-key[data-station="${st}"]`)
    if (!(await key.count())) continue
    await key.tap()
    await p.waitForTimeout(1500)
    console.log(n, st, await p.evaluate(() => ({ away: document.querySelector('.rotate')?.classList.contains('is-away'), dialogs: [...document.querySelectorAll('[role=dialog], .case-board')].map((e) => e.className) })))
    await p.screenshot({ path: `e2e/screenshots/upright-${tag}-${n}-${st}.png`, timeout: 240000 })
    await p.keyboard.press('Escape')
    await p.waitForTimeout(1000)
    console.log(n, st, 'after Escape away=', await p.evaluate(() => document.querySelector('.rotate')?.classList.contains('is-away')))
  }
  await ctx.close()
}
await b.close()
