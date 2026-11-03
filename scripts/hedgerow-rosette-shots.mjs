// Plan item 64: the round-end rosette and its coin flight, at P, D and L, in 2D (and 3D with `3d`).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4191 &
//   then node scripts/hedgerow-rosette-shots.mjs [tag] [2d|3d]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] || 'after'
const mode = process.argv[3] || '2d'
const base = process.env.BASE || 'http://localhost:4191'
const out = 'e2e/screenshots/fieldguide64'
mkdirSync(out, { recursive: true })
const b = await chromium.launch(mode === '3d' ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {})
for (const [n, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }], ['L', { width: 844, height: 390 }]]) {
  const p = await b.newPage({ viewport: vp })
  const URL = `${base}/hedgerow/?${mode === '2d' ? '2d&' : ''}sandbox=1`
  await p.goto(URL)
  await p.evaluate(() => {
    const stars = {}
    for (let i = 1; i < 12; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 12: true }, seen: {}, tips: { all: true } }))
  })
  await p.goto(`${URL}&level=12`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await p.waitForTimeout(mode === '3d' ? 8000 : 800)
  for (const clean of [true, false]) {
    await p.evaluate(([c, slow]) => {
      window.hedgerow.rosette(4, 63, c)
      // SwiftShader takes seconds per screenshot at desktop size: freeze a copy of the pinned rosette for the shot.
      if (slow) {
        const r = document.querySelector('.round-rosette')
        const copy = r.cloneNode(true)
        copy.classList.add('shot-copy')
        copy.style.setProperty('animation', 'rosette-pin 2.6s -1s paused forwards')
        r.after(copy)
      }
    }, [clean, mode === '3d'])
    await p.waitForTimeout(mode === '3d' ? 1500 : 650)
    await p.screenshot({ path: `${out}/rosette-${clean ? 'clean' : 'leaky'}-${mode}-${n}-${tag}.png` })
    console.log('shot', clean, mode, n)
    await p.evaluate(() => document.querySelectorAll('.shot-copy').forEach((e) => e.remove()))
    await p.waitForTimeout(2200)
  }
  await p.close()
}
await b.close()
