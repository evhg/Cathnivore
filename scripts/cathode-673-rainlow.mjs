// Plan item 673: the street at D (high preset, ?shot) rendered at a world scale (?rs=, default 0.5), rain on then
// the mesh named "rain" hidden; counts pixels the rain makes 45+ levels darker (whole frame, the tower windows'
// 560-900 x 60-330 and 0-900 x 0-700, clear of the Pin) and writes both shots to OUT (default e2e/screenshots/ns673). NIGHT SHIFT preview on :4175.
// Q=phone|high|ultra (the quality preset, default high). PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-673-rainlow.mjs [rs] [tag]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const rs = process.argv[2] ?? '0.5', tag = process.argv[3] ?? 'x', out = process.env.OUT ?? 'e2e/screenshots/ns673'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.addInitScript((q) => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: q })), process.env.Q ?? 'high')
await p.goto(`http://localhost:4175/nightshift/?play&class=ghost&shot&rs=${rs}`)
await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) >= 3, null, { timeout: 300000 })
await p.waitForTimeout(3000)
// EVAL=<js> runs in the page first (an experiment on window.cathode), then waits two frames.
if (process.env.EVAL) {
  await p.evaluate((code) => new Function(code)(), process.env.EVAL)
  const e0 = await p.evaluate(() => window.cathode.stats.frames)
  await p.waitForFunction((f) => window.cathode.stats.frames >= f + 2, e0, { timeout: 180000 })
}
// FRAG=<glsl main body> swaps the rain's fragment shader (an experiment), then waits two frames.
if (process.env.FRAG) {
  await p.evaluate((body) => { const c = window.cathode; const sc = c.world?.scene ?? c.scene; sc.traverse((o) => { if (o.name === 'rain') { o.material.fragmentShader = o.material.fragmentShader.replace(/void main\(\) \{[\s\S]*\}\s*$/, `void main() { ${body} }`); o.material.needsUpdate = true } }) }, process.env.FRAG)
  const g0 = await p.evaluate(() => window.cathode.stats.frames)
  await p.waitForFunction((f) => window.cathode.stats.frames >= f + 2, g0, { timeout: 180000 })
}
const on = await p.screenshot({ path: `${out}/rainlow-${tag}-on.png` })
await p.evaluate(() => { const c = window.cathode; const sc = c.world?.scene ?? c.scene; sc.traverse((o) => { if (o.name === 'rain') o.visible = false }) })
const f0 = await p.evaluate(() => window.cathode.stats.frames)
await p.waitForFunction((f) => window.cathode.stats.frames >= f + 2, f0, { timeout: 180000 })
const off = await p.screenshot({ path: `${out}/rainlow-${tag}-off.png` })
const r = await p.evaluate(async ([a, c]) => {
  const load = async (s) => { const i = new Image(); i.src = `data:image/png;base64,${s}`; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const x = cv.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height) }
  const A = await load(a), C = await load(c)
  let all = 0, win = 0, lit = 0, left = 0
  for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
    const i = (y * A.width + x) * 4
    const d = (A.data[i] + A.data[i + 1] + A.data[i + 2] - C.data[i] - C.data[i + 1] - C.data[i + 2]) / 3
    if (d <= -45) { all++; if (x >= 560 && x < 900 && y >= 60 && y < 330) win++; if (x < 900 && y < 700) left++ }
    if (d >= 45) lit++
  }
  return { darker: all, darkerWindows: win, darkerNoPin: left, lighter: lit }
}, [on.toString('base64'), off.toString('base64')])
console.log(JSON.stringify({ rs, tag, ...r }))
await b.close()
