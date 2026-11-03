// Plan item 66: the 3D field as warm as the 2D one. Shoots levels 1, 12 and 30 at P and D in 3D (and 2D beside
// them) at a level's start, and measures each 3D frame's mean luminance and whether the top band is sky.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/warm66/after node scripts/hedgerow-warm-shots.mjs   (MODES=3d SIZES=P LEVELS=12)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/warm66'
const sizes = process.env.SIZES ? process.env.SIZES.split(',') : ['P', 'D']
const modes = process.env.MODES ? process.env.MODES.split(',') : ['3d', '2d']
const levels = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : [1, 12, 30]
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
const results = []
for (const mode of modes)
  for (const size of sizes)
    for (const level of levels) {
      const [w, h] = SIZES[size]
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size !== 'D', isMobile: size !== 'D' })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => console.log('pageerror', String(e)))
      const url = `${base}?sandbox=1${mode === '2d' ? '&2d' : ''}`
      await page.goto(url)
      await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
      await page.goto(`${url}&level=${level}`)
      await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
      await page.waitForTimeout(mode === '2d' ? 800 : 5000)
      const file = `${out}/warm-${mode}-${size}-l${level}.png`
      await page.screenshot({ path: file })
      if (mode === '3d') {
        // Read the WebGL canvas itself (preserveDrawingBuffer may be off, so draw from a screenshot instead).
        const buf = await page.screenshot({ type: 'png' })
        const m = await page.evaluate(async (b64) => {
          const img = new Image()
          img.src = 'data:image/png;base64,' + b64
          await img.decode()
          const c = document.createElement('canvas')
          c.width = img.width; c.height = img.height
          const x = c.getContext('2d')
          x.drawImage(img, 0, 0)
          const cv = document.querySelector('canvas')
          const r = cv.getBoundingClientRect()
          const s = img.width / innerWidth
          const d = x.getImageData(Math.round(r.left * s), Math.round(r.top * s), Math.round(r.width * s), Math.round(r.height * s))
          const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
          let sum = 0, n = 0
          for (let i = 0; i < d.data.length; i += 16) { sum += 0.2126 * lin(d.data[i]) + 0.7152 * lin(d.data[i + 1]) + 0.0722 * lin(d.data[i + 2]); n++ }
          return { luma: sum / n, top: (await window.hedgerow?.skyBand?.()) ?? null }
        }, buf.toString('base64'))
        results.push({ size, level, ...m })
        console.log(file, JSON.stringify(m))
      } else console.log(file)
      await ctx.close()
    }
writeFileSync(`${out}/luma.json`, JSON.stringify(results, null, 1))
await browser.close()
