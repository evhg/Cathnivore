// Plan item 7: shoots every district's alarm entrances (breach, rappel, van) mid-flight. Boots each district with
// the tutorial marked done, walks her onto the lead job's objective (the market's first job skips to the flyover),
// keeps her alive, and shoots a few frames aimed at each entrance in turn.
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-entrance-shots.mjs [district ...]
//
// Env: CATHODE_URL (default http://localhost:4180/nightshift/), OUT (default e2e/screenshots/entrances),
// VPS=d,l (d = 1440x900 desktop quality, l = 844x390 touch, phone quality), FRAMES (default 6).
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots/entrances'
const frames = Number(process.env.FRAMES ?? 6)
mkdirSync(out, { recursive: true })
const districts = process.argv.slice(2).length ? process.argv.slice(2) : ['market', 'clinic', 'plaza', 'tower', 'vault']
const VPS = {
  d: { viewport: { width: 1440, height: 900 }, quality: undefined, touch: false },
  l: { viewport: { width: 844, height: 390 }, quality: 'phone', touch: true },
}
const vps = (process.env.VPS ?? 'd,l').split(',')
const args = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args })
const report = []
for (const vp of vps) {
  const cfg = VPS[vp]
  for (const d of districts) {
    const ctx = await browser.newContext({ viewport: cfg.viewport, hasTouch: cfg.touch, isMobile: cfg.touch, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const prefs = { adult: true, intensity: 'full', ...(cfg.quality ? { quality: cfg.quality } : {}) }
    await page.goto(base)
    await page.evaluate((p) => localStorage.setItem('cathode:prefs:v1', JSON.stringify(p)), prefs)
    const ready = (lead) => page.waitForFunction((lead) => {
      const c = window.cathode
      return !!c && c.stats.frames >= 3 && (lead ? !!c.lead?.()?.target : !!c.job)
    }, lead, { timeout: 300_000 })
    if (d !== 'market') {
      await page.goto(`${base}?play&class=ghost`)
      await ready(false)
      await page.evaluate(() => { window.cathode.progress.jobsDone.push('fishMarket'); window.cathode.progress.save() })
      await page.goto(`${base}?play&class=ghost&district=${d}`)
      await ready(true)
    } else {
      await page.goto(`${base}?play&class=ghost`)
      await ready(false)
    }
    // The case file eases out over dozens of frames under software WebGL: shoot only once it is gone.
    await page.waitForFunction(() => document.getElementById('loading')?.hidden !== false, null, { timeout: 300_000 })
    await page.evaluate((market) => {
      const c = window.cathode
      // Alive through the shoot: the alarm's guards are firing at her.
      setInterval(() => { c.vitals.guard = c.vitals.maxGuard; c.vitals.flesh = c.vitals.maxFlesh }, 50)
      // Slow the world right down so the entrances are caught mid-flight (headless WebGL runs at a few fps).
      c.testTimeScale = 0.2
      if (market) {
        // She stands at Tomas's case when the flyover pair come in (the stage before).
        c.job.skipTo(2)
        const at = c.job.target.clone()
        c.job.skipTo(3)
        c.player.pos.set(at.x, c.player.pos.y, at.z)
      } else c.player.pos.copy(c.lead().target)
    }, d === 'market')
    await page.waitForFunction(() => (window.cathode.entrances ?? []).length >= 1, null, { timeout: 300_000 })
    for (let i = 0; i < frames; i++) {
      const info = await page.evaluate((i) => {
        const c = window.cathode
        const ev = c.entrances[i % c.entrances.length]
        const p = c.player.pos
        const dx = ev.at.x - p.x, dz = ev.at.z - p.z
        const lift = ev.kind === 'rappel' ? 2.6 : 1.1
        c.player.yaw = Math.atan2(-dx, -dz)
        c.player.pitch = Math.atan2(ev.at.y + lift - (p.y + 1.6), Math.hypot(dx, dz))
        const e = c.enemies.filter((x) => x.alive && (x.entering || x.lift > 0)).length
        return { kind: ev.kind, dist: +Math.hypot(dx, dz).toFixed(1), entering: e }
      }, i)
      await page.waitForTimeout(1500)
      const file = `${out}/${d}-${vp}-${i}-${info.kind}.png`
      await page.screenshot({ path: file, timeout: 240_000 })
      report.push({ file, ...info })
      console.log(file, JSON.stringify(info))
    }
    await ctx.close()
  }
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2))
await browser.close()
