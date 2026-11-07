// Plan item 260: shoots the NIGHT SHIFT title or class pick at D and P with a zoom and a face crop at DPR (env DPR).
// Needs a dist-site preview on :4190. Usage: OUT=<dir> DPR=4 node scripts/cathode-face-zoom.mjs <tag> [title|classpick]
import { chromium } from '@playwright/test'
const [tag, front='title'] = process.argv.slice(2)
const out = process.env.OUT
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['D', { width: 1440, height: 900 }], ['P', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: Number(process.env.DPR||(n==='D'?2:3)) })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4190/nightshift/?shot')
  await p.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto(`http://localhost:4190/nightshift/?front=${front}&shot&t=8&quality=phone${front==='classpick'?'&class=ghost':''}`)
  await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 200000 })
  await p.waitForTimeout(3000)
  const f = await p.evaluate(() => window.cathodeFront.scene().faceBox())
  const g = await p.evaluate(() => window.cathodeFront.scene().figureBox(true))
  console.log(n, front, 'face', Math.round(f.right-f.left), Math.round(f.bottom-f.top), 'fig', JSON.stringify(g))
  await p.screenshot({ path: `${out}/${tag}-${front}-${n}.png`, scale: 'css' })
  const w = (f.right-f.left), h=(f.bottom-f.top)
  await p.screenshot({ path: `${out}/${tag}-${front}-${n}-zoom.png`, clip: { x: f.left - w*0.8, y: f.top - h*0.5, width: w*2.6, height: h*3.2 } })
  await p.screenshot({ path: `${out}/${tag}-${front}-${n}-face.png`, clip: { x: f.left, y: f.top, width: w, height: h } })
  await ctx.close()
}
await b.close()
