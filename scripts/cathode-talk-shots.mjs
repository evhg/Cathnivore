// Plan item 14: the lieutenant's mark in the street and his talk after the grab, at D and L.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
// then node scripts/cathode-talk-shots.mjs (DISTRICTS=clinic,plaza SIZES=D,L TAG=after).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.URL ?? 'http://localhost:4180/nightshift/'
const out = process.env.OUT ?? '/home/user/Cathnivore/e2e/screenshots'
const tag = process.env.TAG ?? 'after'
mkdirSync(out, { recursive: true })
const SIZES = {
  L: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  D: { viewport: { width: 1440, height: 900 } },
}
const districts = (process.env.DISTRICTS ?? 'clinic').split(',')
const sizes = (process.env.SIZES ?? 'D,L').split(',')
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const d of districts) {
  for (const s of sizes) {
    const ctx = await browser.newContext({ ...SIZES[s] })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.log('pageerror', e.message))
    await page.goto(base)
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'low' })))
    const ready = () => page.waitForFunction(() => !!window.cathode && window.cathode.stats.frames >= 3, null, { timeout: 300_000 })
    await page.goto(`${base}?play&class=wirewitch&rs=0.5`)
    await ready()
    await page.evaluate(() => { window.cathode.progress.jobsDone.push('fishMarket'); window.cathode.progress.character.scrip = 500; window.cathode.progress.save() })
    await page.goto(`${base}?play&class=wirewitch&rs=0.5&district=${d}`)
    await ready()
    await page.waitForFunction(() => document.getElementById('loading')?.hidden !== false, null, { timeout: 300_000 })
    // 5 m behind him, looking at his back: the mark over his head.
    const place = (m) => page.evaluate((m) => {
      const c = window.cathode
      const g = c.lieutenant()
      if (!g) return null
      const yaw = g.motion.yaw
      c.player.pos.set(g.position.x - Math.sin(yaw) * m, g.position.y, g.position.z - Math.cos(yaw) * m)
      c.player.yaw = Math.atan2(-Math.sin(yaw), -Math.cos(yaw))
      c.player.pitch = -0.05
      return g.kit.name
    }, m)
    console.log(d, s, await place(5))
    await page.waitForTimeout(2500)
    await place(5)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${out}/talk-${d}-mark-${s}-${tag}.png`, timeout: 240_000 })
    await place(1.3)
    await page.waitForTimeout(1500)
    await place(1.3)
    await page.evaluate(() => (window.cathode.input.forced = { takedown: true }))
    await page.waitForSelector('.talk-card', { timeout: 240_000 }).catch(() => console.log('no talk'))
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${out}/talk-${d}-grab-${s}-${tag}.png`, timeout: 240_000 })
    await ctx.close()
  }
}
await browser.close()
