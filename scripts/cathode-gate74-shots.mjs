// Plan item 74: the NIGHT SHIFT 18+ gate at P and D. Needs a dist-site preview on :4186.
// Usage: node scripts/cathode-gate74-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage()
  await p.goto('http://localhost:4186/nightshift/')
  await p.waitForSelector('#screen-gate:not([hidden])', { timeout: 20000 })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `e2e/screenshots/bugs74/nsgate-${tag}-${n}.png` })
  const boxes = await p.evaluate(() => [...document.querySelectorAll('#screen-gate *')].filter((e) => e.getBoundingClientRect().width > 0).slice(0, 40).map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName.toLowerCase()}.${e.className} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` }))
  console.log(n, boxes.join('\n'))
  await p.context().close()
}
await b.close()
