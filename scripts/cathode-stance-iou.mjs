// Plan item 579: how different her five class stances read on the pick: 1 - IoU of her settled silhouettes
// (scene().figureMask(), her projected triangles) for every pair of classes, at D and P, plus a shot of each.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
//   node scripts/cathode-stance-iou.mjs [outdir] [D,P]
import { chromium } from 'playwright'
const dir = process.argv[2] ?? 'e2e/screenshots/s579'
const which = (process.argv[3] ?? 'D,P').split(',')
const base = `${process.env.SITE_URL ?? 'http://localhost:4186'}/nightshift/`
const CLASSES = (process.env.CLASSES ?? 'ghost,butcher,gunslinger,wirewitch,fixer').split(',')
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const sizes = { P: { width: 390, height: 844 }, D: { width: 1440, height: 900 } }
for (const n of which) {
  const ctx = await b.newContext({ viewport: sizes[n], hasTouch: n !== 'D' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  const masks = {}
  for (const cls of CLASSES) {
    await p.goto(`${base}?front=classpick&shot&t=8&class=${cls}${n === 'D' ? '' : '&quality=phone'}`, { timeout: 180000 })
    await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
    // setTime runs a second of her updates before it draws, so one call holds the stance at full weight.
    const pose = await p.evaluate(() => { const s = window.cathodeFront.scene(); s.setTime(20); return s.figurePose() })
    masks[cls] = await p.evaluate(() => window.cathodeFront.scene().figureMask(4))
    console.log(n, cls, "inCoat", JSON.stringify(await p.evaluate(() => window.cathodeFront.scene().weaponInCoat())))
    await p.screenshot({ path: `${dir}/${n}-${cls}.png`, timeout: 240000 })
    console.log(n, cls, "pose", pose?.kind, pose?.w, "hand", pose?.hand?.map((v) => v.toFixed(3)).join(","), "area", [...masks[cls].bits].filter((c) => c === '1').length)
  }
  const rows = []
  for (let i = 0; i < CLASSES.length; i++)
    for (let j = i + 1; j < CLASSES.length; j++) {
      const a = masks[CLASSES[i]].bits, c = masks[CLASSES[j]].bits
      let inter = 0, uni = 0
      for (let k = 0; k < a.length; k++) { const x = a[k] === '1', y = c[k] === '1'; if (x && y) inter++; if (x || y) uni++ }
      rows.push([`${CLASSES[i]}-${CLASSES[j]}`, +(1 - inter / uni).toFixed(3)])
    }
  rows.sort((x, y) => x[1] - y[1])
  console.log(n, JSON.stringify(rows))
  await ctx.close()
}
await b.close()
