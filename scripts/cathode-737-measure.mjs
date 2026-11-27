// Plan item 737: NIGHT SHIFT on a phone held sideways (844x390, touch): the share of the viewport the HUD covers
// (bar the touch controls), per element, on a live first-job frame; and a shot.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-737-measure.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/ns737'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
const p = await ctx.newPage()
// as cathode-hud.spec's boot(): a class, so ?play skips the pick, and a low render scale for SwiftShader
await p.goto('http://localhost:4186/nightshift/?play&class=gunslinger&rs=0.5')
await p.waitForFunction(() => !!window.cathode?.job && window.cathode.stats.frames >= 3, null, { timeout: 240000 })
for (const wait of [Number(process.env.T1 ?? 8000), Number(process.env.T2 ?? 6000)]) {
  await p.waitForTimeout(wait)
  const m = await p.evaluate(() => {
    const W = innerWidth, H = innerHeight
    const sel = ['.hud-objective', '.hud-vitals', '.hud-teach', '.hud-compass', '.hud-tr', '.hud-wp', '.hud-sub', '.hud-feed', '.hud-prompt', '.look-hint', '.stick-tip']
    const boxes = []
    for (const s of sel)
      for (const e of document.querySelectorAll(s)) {
        const cs = getComputedStyle(e)
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue
        const r = e.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue
        boxes.push({ s, r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], a: Math.round(((r.width * r.height) / (W * H)) * 1000) / 10 })
      }
    let hit = 0, n = 0
    for (let y = 1; y < H; y += 3)
      for (let x = 1; x < W; x += 3, n++) if (boxes.some((b) => x >= b.r[0] && x <= b.r[2] && y >= b.r[1] && y <= b.r[3])) hit++
    return { share: Math.round((hit / n) * 1000) / 10, boxes, teach: document.querySelector('.hud-teach')?.textContent }
  })
  console.log(tag, wait, JSON.stringify(m))
}
await p.screenshot({ path: `${out}/${tag}-L.png`, timeout: 240000 })
await b.close()
