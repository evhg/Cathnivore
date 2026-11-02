// Plan item 12: the district map (opened from the pause menu's Case board) at D and L, fresh and mid-game, with a
// DOM check that no two labels overlap. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
// then node scripts/cathode-map-shots.mjs (CASES=market-fresh,market-mid,clinic-mid SIZES=D,L TAG=after).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.URL ?? 'http://localhost:4180/nightshift/'
const out = process.env.OUT ?? '/home/user/Cathnivore/e2e/screenshots'
const tag = process.env.TAG ?? 'after'
mkdirSync(out, { recursive: true })
const SIZES = {
  P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  L: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  D: { viewport: { width: 1440, height: 900 } },
}
const cases = (process.env.CASES ?? 'market-fresh,market-mid,clinic-mid').split(',')
const sizes = (process.env.SIZES ?? 'D,L').split(',')
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const c of cases) {
  const [district, save] = c.split('-')
  for (const s of sizes) {
    const ctx = await browser.newContext({ ...SIZES[s] })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.log('pageerror', e.message))
    const jobs = save === 'mid' ? ['fishMarket', 'crispBoss', 'vaneBoss', 'secret:log-bea1', 'secret:stash-roof'] : save === 'tip' ? ['fishMarket', 'talk:foreman:pay'] : []
    await page.goto(base)
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'low' })))
    const ready = () => page.waitForFunction(() => !!window.cathode && window.cathode.stats.frames >= 3, null, { timeout: 300_000 })
    await page.goto(`${base}?play&class=ghost`)
    await ready()
    if (jobs.length) await page.evaluate((j) => { window.cathode.progress.jobsDone.push(...j); window.cathode.progress.save() }, jobs)
    if (district !== 'market') {
      await page.goto(`${base}?play&class=ghost&district=${district}`)
      await ready()
    }
    await page.waitForFunction(() => document.getElementById('loading')?.hidden !== false, null, { timeout: 300_000 })
    // From pause, as a player gets there: the pause menu's Case board opens the map.
    for (let i = 0; i < 20 && !(await page.$('.district-map')); i++) {
      await page.evaluate(() => window.cathode.hud.onCaseBoard?.())
      await page.waitForTimeout(1500)
    }
    await page.waitForTimeout(1500)
    const r = await page.evaluate(() => {
      const t = [...document.querySelectorAll('.dmap-t')].map((e) => ({ s: e.textContent, b: e.getBoundingClientRect() }))
      const hits = []
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
        const a = t[i].b, b = t[j].b
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hits.push(`${t[i].s} x ${t[j].s}`)
      }
      const fs = t.map((x) => x.b.height)
      return { n: t.length, hits, minH: Math.min(...fs).toFixed(1) }
    })
    console.log(c, s, JSON.stringify(r))
    await page.screenshot({ path: `${out}/dmap-${c}-${s}-${tag}.png`, timeout: 240_000 })
    await ctx.close()
  }
}
await browser.close()
