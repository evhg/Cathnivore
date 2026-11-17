// Plan item 481: frozen-time shots of skill previews on the class pick (needs a dist-site preview on :4186).
//   node scripts/cathode-skillpreview-shots.mjs <outPrefix> P,D <class:tree:seconds[:sceneSeconds]>...
// (the real wait and the scene time apart: particles never age under ?shot, so wait less in real time than a look's
// particles take to fire and still pose the standing pieces later)
import { chromium } from '@playwright/test'
const [prefix, sizes, ...jobs] = process.argv.slice(2)
const base = 'http://localhost:4186/nightshift/'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const s of sizes.split(',')) {
  const [w, h, q] = s === 'P' ? [390, 844, 'phone'] : [1440, 900, 'high']
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: s === 'P' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  for (const job of jobs) {
    const [cls, tree, dt, at = dt] = job.split(':')
    const p = await ctx.newPage()
    await p.goto(`${base}?front=classpick&shot&t=8&quality=${q}&class=${cls}`, { timeout: 180_000 })
    await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 400_000 })
    await p.waitForTimeout(2500)
    await p.evaluate(async ([tree, dt, at]) => {
      const sc = window.cathodeFront.scene()
      sc.setTime(8.5)
      if (tree !== '-') { const r = document.querySelector('.cp-tree[data-tree="' + tree + '"]'); if (r) r.click(); else sc.skillPreview(tree) }
      await new Promise((r) => setTimeout(r, Number(dt) * 1000))
      sc.setTime(8.5 + Number(at))
    }, [tree, dt, at])
    await p.waitForTimeout(300)
    await p.screenshot({ path: `${prefix}-${s}-${tree}-${dt}.png` })
    console.log('shot', s, tree, dt)
    await p.close()
  }
  await ctx.close()
}
await b.close()
