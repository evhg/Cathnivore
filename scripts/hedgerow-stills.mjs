// Plan item 583: a 3D still of every Hedgerow level for its level card (the schematic plate is the fallback).
// Needs a dist-site preview: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//   SITE_URL=http://localhost:4180 node scripts/hedgerow-stills.mjs [first] [last]
// Writes games/hedgerow/public/stills/level-<id>.webp (400x275); about 13 s a level under SwiftShader.
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const base = process.env.SITE_URL ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'games/hedgerow/public/stills'
const first = Number(process.argv[2] ?? 1)
const last = Number(process.argv[3] ?? 100)
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const p = await (await b.newContext({ viewport: { width: 640, height: 440 }, reducedMotion: 'reduce' })).newPage()
await p.goto(`${base}/hedgerow/?sandbox=1`)
const seen = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i + 1, true]))
await p.evaluate((s) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: s, tips: { all: true } })), seen)
for (let lv = first; lv <= last; lv++) {
  await p.goto(`${base}/hedgerow/?keyart&sandbox=1&level=${lv}`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  // The field alone: no gate plates, queue names or Cath's ring over it.
  await p.addStyleTag({ content: 'body * { visibility: hidden !important; } #canvas { visibility: visible !important; }' })
  await p.waitForTimeout(3500)
  const png = (await p.screenshot()).toString('base64')
  const webp = await p.evaluate(async (src) => {
    const img = new Image()
    img.src = `data:image/png;base64,${src}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 400
    c.height = 275
    const g = c.getContext('2d')
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, 0, 0, 400, 275)
    return c.toDataURL('image/webp', 0.7).split(',')[1]
  }, png)
  writeFileSync(`${out}/level-${lv}.webp`, Buffer.from(webp, 'base64'))
  console.log(lv)
}
await b.close()
