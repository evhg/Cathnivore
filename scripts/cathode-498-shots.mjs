// Plan item 498: the live class pick (?play) per class at D/P/L, with each set prop's on-screen share (outside the list and sheet).
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//   SP=<out dir> VPS=D,P PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-498-shots.mjs <tag>   (writes $SP/p498/<tag>-<size>-<class>.png)
import { chromium } from '@playwright/test'
const SP = process.env.SP, tag = process.argv[2] ?? 'x'
const sizes = (process.env.VPS ?? 'D').split(',')
const VP = { P: [390, 844, 2], D: [1440, 900, 1], L: [844, 390, 2] }
const ALL = ['ghost','butcher','gunslinger','wirewitch','fixer']
const classes = (process.env.CLASSES ?? ALL.join(',')).split(',')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const s of sizes) {
  const [w, h, dpr] = VP[s]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: s !== 'D' })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const page = await ctx.newPage()
  await page.goto(`http://localhost:4186/nightshift/?play`, { timeout: 180_000 })
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.class, null, { timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(15000)
  for (const cls of classes) {
    if (s === 'D') await page.keyboard.press(String(ALL.indexOf(cls) + 1))
    else await page.locator(`[data-class="${cls}"], [data-id="${cls}"]`).first().click({ timeout: 5000 }).catch(() => page.keyboard.press(String(ALL.indexOf(cls) + 1)))
    await page.waitForTimeout(Number(process.env.WAIT ?? 12000))
    const info = await page.evaluate(() => { const sc = window.cathodeFront?.scene?.(); const R = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null }
      const covers = [R('.cp .cp-left'), R('.cp .cp-sheet')].filter(Boolean)
      const props = (sc?.setPropBoxes?.() ?? []).map((b) => {
        // the share of its box on screen and outside the list and the sheet (sampled on a grid)
        let n = 0, vis = 0
        for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
          const x = b.left + ((i + 0.5) / 20) * (b.right - b.left), y = b.top + ((j + 0.5) / 20) * (b.bottom - b.top)
          n++
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
          if (covers.some((c) => x >= c.left && x <= c.right && y >= c.top && y <= c.bottom)) continue
          vis++
        }
        return `${b.name}:${Math.round((100 * vis) / n)}%[${b.left},${b.top},${b.right},${b.bottom}]`
      })
      return sc && { calls: sc.stats.drawCalls, set: sc.renderer?.domElement?.dataset?.setProps ?? document.querySelector('canvas')?.dataset.setProps, props } })
    await page.screenshot({ path: `${SP}/p498/${tag}-${s}-${cls}.png`, timeout: 300_000 })
    console.log(s, cls, JSON.stringify(info))
  }
  await ctx.close()
}
await browser.close()
