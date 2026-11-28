import { chromium } from 'playwright'
const tag = process.argv[2]
const dir = process.argv[3]
const b = await chromium.launch()
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4186/runnel/?nohelp&sky=noon')
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${dir}/${tag}-${n}.png` })
  const info = await p.evaluate(() => {
    const f = document.getElementById('runnel-feeder')
    const sp = document.querySelector('.tiles > g.cell.spring')?.getBoundingClientRect()
    return { end: f?.dataset.end, hidden: f?.hasAttribute('hidden'), spring: sp && [Math.round(sp.x), Math.round(sp.y), Math.round(sp.width)] }
  })
  console.log(n, JSON.stringify(info))
  await ctx.close()
}
await b.close()
