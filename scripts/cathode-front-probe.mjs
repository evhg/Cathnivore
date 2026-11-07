// Plan item 261: where world points land on NIGHT SHIFT's title frame. Projects PTS (world metres, JSON) through the
// title camera at loop times 0, 9, 18 and 27 s and prints them with her figure box and the neon's box, so set props
// can be placed in the strip the lens actually sees. Usage (a dist-site preview on :4180):
//   PTS='[[-1.1,0.6,63.3]]' W=1440 H=900 node scripts/cathode-front-probe.mjs   (SHOT=out.png for a frame)
import { chromium } from '@playwright/test'
const vw = +(process.env.W ?? 1440), vh = +(process.env.H ?? 900)
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const p = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage()
await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
await p.goto('http://localhost:4180/nightshift/' + (process.env.Q ?? ''))
await p.waitForTimeout(+(process.env.T ?? 30000))
const pts = JSON.parse(process.env.PTS ?? '[[-5.6,1.5,63.9],[-7.35,0.6,63.4],[-3.6,4.4,63],[-4.6,0,61.4],[-1.9,0,58.2],[-9.9,2,60]]')
const r = await p.evaluate(async (pts) => {
  const s = window.cathodeFront.scene(); if (!s) return 'no scene'
  const out = []; for (const t of [0, 9, 18, 27]) { s.setTime(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const cam = s.world.camera; cam.updateMatrixWorld()
  const proj = (v) => { const e = cam.matrixWorldInverse.elements; const x = e[0]*v[0]+e[4]*v[1]+e[8]*v[2]+e[12], y = e[1]*v[0]+e[5]*v[1]+e[9]*v[2]+e[13], z = e[2]*v[0]+e[6]*v[1]+e[10]*v[2]+e[14]
    const P = cam.projectionMatrix.elements; const cx = P[0]*x+P[8]*z, cy = P[5]*y+P[9]*z, w = -z; return [Math.round((cx/w*0.5+0.5)*innerWidth), Math.round((0.5-cy/w*0.5)*innerHeight), +w.toFixed(1)] }
  out.push({ t, cam: cam.position.toArray().map(n => +n.toFixed(2)), time: s.time, pts: pts.map(proj), fig: s.figureBox(), neon: s.neonBox() }) }
  return out
}, pts)
for (const o of r) console.log(JSON.stringify(o))
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT })
await b.close()
