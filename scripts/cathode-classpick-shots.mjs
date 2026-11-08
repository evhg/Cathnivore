// Plan item 42: the class pick with Cath facing the camera, for all five classes at P (390x844), D (1440x900) and
// L (844x390), from `?front=classpick&shot&class=<id>`. Reports her head's on-screen height share (from the front
// scene's hero model) per shot.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-classpick-shots.mjs [tag]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const tag = process.argv[2] ?? 'after'
const base = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots/classpick'
mkdirSync(out, { recursive: true })
const sizes = (process.env.VPS ?? 'D,P,L').split(',')
const VP = { P: [390, 844, 'phone'], D: [1440, 900, 'high'], L: [844, 390, 'phone'] }
const classes = (process.env.CLASSES ?? 'ghost,butcher,gunslinger,wirewitch,fixer').split(',')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const s of sizes) {
  const [w, h, q] = VP[s]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: s !== 'D' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  for (const cls of classes) {
    const page = await ctx.newPage()
    await page.goto(`${base}?front=classpick&shot&t=${process.env.T ?? 8}&quality=${q}&class=${cls}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
    await page.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 400_000 })
    await page.waitForTimeout(2500)
    // Plan item 161: her projected box against the list's names and the sheet's plate.
    const head = await page.evaluate(() => {
      const f = window.cathodeFront?.scene?.()?.figureBox?.()
      const names = Math.max(...[...document.querySelectorAll('.cp-opt-name')].map((e) => e.getBoundingClientRect().right))
      const sheet = document.querySelector('.cp-sheet')?.getBoundingClientRect()
      return f && { fig: [f.left, f.top, f.right, f.bottom].map(Math.round), h: Math.round(f.bottom - f.top), names: Math.round(names), sheet: sheet && Math.round(sheet.left) }
    })
    await page.screenshot({ path: `${out}/${tag}-${s}-${cls}.png`, timeout: 300_000 })
    console.log(s, cls, head ? `head ${JSON.stringify(head)}` : '')
    await page.close()
  }
  await ctx.close()
}
await browser.close()
