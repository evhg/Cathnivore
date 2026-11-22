// Plan item 657: Hedgerow l21 (sandbox) with round 11 sent and no towers, shot 3 s and 8 s after the send at D and P,
// 2D and 3D (MODES=2d,3d), into <out>/<tag>-<mode>-<size>-<ms>.png, with the fleet's spread printed: vehicles per
// lane cell (floor(dist)) and the renderer's convoy stats.
//   node scripts/hedgerow-657-shots.mjs http://localhost:<port> <out> <tag>
import { chromium } from '@playwright/test'
const [base, out, tag] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const modes = (process.env.MODES ?? '2d').split(',')
const sizes = (process.env.SIZES ?? 'D,P').split(',')
const all = { D: [1440, 900, false], P: [390, 844, true] }
for (const mode of modes)
  for (const n of sizes) {
    const [w, h, touch] = all[n]
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })
    const p = await ctx.newPage()
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
    await p.goto(`${base}/hedgerow/?2d`)
    await p.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 21: true }, tips: t })), [stars, tips])
    await p.goto(`${base}/hedgerow/?sandbox=1&level=21${mode === '2d' ? '&2d' : ''}`)
    await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 120000 })
    await p.waitForTimeout(mode === '2d' ? 1000 : 5000)
    await p.evaluate((wave) => {
      const hg = window.hedgerow
      const g = hg.game()
      g.wave = wave
      hg.sendWave(g, true)
    }, Number(process.env.WAVE ?? 10))
    // a new vehicle's field-guide page holds the round: close it
    for (let i = 0; i < 6; i++) {
      const go = p.locator('.intro:not([hidden]) .intro-go')
      if (await go.isVisible().catch(() => false)) await go.click().catch(() => {})
      else if (await p.evaluate(() => window.hedgerow.game().enemies.length >= 1)) break
      await p.waitForTimeout(400)
    }
    const shut = async () => {
      const go = p.locator('.intro:not([hidden]) .intro-go')
      if (await go.isVisible().catch(() => false)) await go.click().catch(() => {})
    }
    const t0 = Date.now()
    for (const ms of [3000, 8000]) {
      while (Date.now() - t0 < ms) { await shut(); await p.waitForTimeout(250) }
      await p.screenshot({ path: `${out}/${tag}-${mode}-${n}-${ms}.png` })
      if (process.env.CLIP) { const [x, y, cw, chh] = process.env.CLIP.split(',').map(Number); await p.screenshot({ path: `${out}/${tag}-${mode}-${n}-${ms}-clip.png`, clip: { x, y, width: cw, height: chh } }) }
      const st = await p.evaluate(() => {
        const g = window.hedgerow.game()
        const cells = {}
        for (const e of g.enemies) {
          const k = `${e.lane ? 'b' : 'a'}${Math.floor(e.dist)}`
          cells[k] ??= {}
          cells[k][e.kind] = (cells[k][e.kind] ?? 0) + 1
        }
        return { n: g.enemies.length, cells, convoy: window.hedgerow.convoy(), path: g.level.path, len: g.pathLength, amb: g.spawnQueue.filter((q) => q.ambush).slice(0, 2), speed: [...new Set(g.enemies.map((e) => e.kind + ':' + (e.speed ?? '')))] }
      })
      console.log(tag, mode, n, ms, JSON.stringify(st))
    }
    await ctx.close()
  }
await b.close()
