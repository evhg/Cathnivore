import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await b.newPage()
await page.goto('http://localhost:4190/hedgerow/index.html').catch(()=>{})
await page.goto('http://localhost:4190/')
const r = await page.evaluate(async () => {
  const sp = await import('/src/sprites.ts'); const en = await import('/src/engine.ts')
  const out = {}
  const S = 64, W = S * 4, H = S * 4, cy = S * 3
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  for (const kind of Object.keys(en.TOWERS)) for (const tier of [1, 2, 3]) {
    let foot = 0, all = 0
    for (const bare of [true, false]) {
      ctx.clearRect(0, 0, W, H)
      sp.drawTower(ctx, { kind, tier, spec: null, fired: 9, dazed: false, bare, still: true }, W / 2, cy, S, 0)
      const px = ctx.getImageData(0, 0, W, H).data
      const base = cy + S * 0.3
      let f = 0, a = 0
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 150) {
        const d = Math.abs(x + 0.5 - W / 2) / S; a = Math.max(a, d)
        if (y > base - S * 0.25) f = Math.max(f, d)
      }
      if (bare) { foot = f; all = a } else out[`${kind}${tier}`] = { bodyFoot: +foot.toFixed(2), bodyHalf: +all.toFixed(2), fullFoot: +f.toFixed(2) }
    }
  }
  return out
})
console.log(JSON.stringify(r).replace(/\},/g, '},\n'))
await b.close()
