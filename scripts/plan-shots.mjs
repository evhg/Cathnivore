// Planning shots (CLAUDE.md step 4): every game's main screens at P (390x844) and D (1440x900), for a fresh-eyes
// critique against VISION.md. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/plan1103f node scripts/plan-shots.mjs   (ONLY=hedgerow,runnel)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'e2e/screenshots/plan'
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, D: { viewport: { width: 1440, height: 900 } } }
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
const jobs = {
  async site(p, s) {
    // Plan item 146: the entrance (kinetic title, Cath and the prints rising) runs about 3 s; shoot it settled.
    await p.goto(`${base}/`); await p.waitForTimeout(3500); await p.screenshot({ path: `${out}/portfolio-${s}.png` })
    // (the intro letters settle by about 3 s on a phone: at 1.2 s the wordmark was a blurred "Ca", plan1114c)
    await p.goto(`${base}/games/`); await p.waitForTimeout(4000); await p.screenshot({ path: `${out}/games-${s}.png` })
  },
  async cathnivore(p, s) {
    await p.goto(`${base}/cathnivore/?e2eHandFan=1`); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/cath-title-${s}.png` })
    await p.getByText('Quick Game').click(); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/cath-setup-${s}.png` })
    await p.getByRole('button', { name: 'Start' }).click()
    // Item 369: the pointer left over Start lifts whichever hand card lands under it (the 'Injunction under Supply'
    // seen in three critiques was that hover); park it off the table.
    if (s === 'D') await p.mouse.move(2, 2)
    await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/cath-game-${s}.png` })
    try {
      await p.goto(`${base}/cathnivore/`); await p.waitForTimeout(1200)
      await p.getByText('Campaign', { exact: false }).first().click(); await p.waitForTimeout(1500)
      await p.screenshot({ path: `${out}/cath-campaign-${s}.png` })
    } catch (e) { console.log('campaign', s, String(e).split('\n')[0]) }
  },
  async runnel(p, s) {
    // Plan item 666: a fresh visitor opens the first-week climb (item 653), not the daily: shoot the daily a returning
    // player sees (the climb done, the help seen).
    await p.goto(`${base}/runnel/`)
    await p.evaluate(() => localStorage.setItem('runnel:v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('runnel:v1') ?? '{}'), version: 1, climbDone: true, seenHelp: true })))
    await p.goto(`${base}/runnel/`); await p.waitForTimeout(2000); await p.screenshot({ path: `${out}/runnel-${s}.png` })
    // Plan item 615: the solved daily's result strip (the critiques never saw a win)
    await p.goto(`${base}/runnel/?shotwin&nohelp`); await p.waitForTimeout(5000); await p.screenshot({ path: `${out}/runnel-solved-${s}.png` })
  },
  async hedgerow(p, s) {
    // Plan item 650: the mid-level shots show a battle, not a bare sandbox field: up to eight of the level's towers on
    // plots beside the lane, then its round under way.
    const battle = async (warp = 0) => {
      await p.evaluate(() => {
        const hg = window.hedgerow, g = hg.game()
        const path = [...(g.level.path ?? []), ...(g.level.path2 ?? [])]
        const near = (c, r) => Math.min(...path.map(([pc, pr]) => Math.abs(pc - c) + Math.abs(pr - r)))
        const spots = []
        for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) spots.push([near(c, r), c, r])
        // plan item 676: beside the lane, the plots covering the most of it first (where the fight is), not the first found
        const cover = (c, r) => path.filter(([pc, pr]) => Math.hypot(pc - c, pr - r) <= 2.2).length
        spots.sort((a, b) => (a[0] > 1) - (b[0] > 1) || cover(b[1], b[2]) - cover(a[1], a[2]) || a[0] - b[0])
        const kinds = g.level.towers
        let n = 0
        for (const [, c, r] of spots) {
          if (n >= 8) break
          if (hg.place(g, kinds[n % kinds.length], c, r).ok) n++
        }
        hg.arm?.(g)
        hg.sendWave(g, true)
      })
      // plan item 656: a new vehicle's field-guide page holds the round until it's dismissed ('0 NEXT', an empty road
      // under it): close each one, then wait for three vehicles on the lane and a beat for the towers to open up
      // plan item 677: at P the page's 'Got it' sits below the sheet's fold and a pointer click missed it, and a page
      // that opened after the loop stood over the shot: press it through the DOM, and again just before the shot.
      const closeGuide = () => p.evaluate(() => {
        const go = document.querySelector('.intro:not([hidden]) .intro-go')
        go?.click()
        return !!go
      })
      for (let i = 0; i < 12; i++) {
        await p.waitForTimeout(700)
        if (await closeGuide()) continue
        if (await p.evaluate(() => window.hedgerow.game().enemies.length >= 3)) break
      }
      await p.waitForFunction(() => (window.hedgerow.game().enemies?.length ?? 0) >= 3, null, { timeout: 45000 }).catch(() => console.log('battle: under 3 vehicles'))
      await p.waitForTimeout(1500)
      for (let i = 0; i < 4 && (await closeGuide()); i++) await p.waitForTimeout(600)
      // plan item 676: headless 3D draws a few frames a second and the sim steps at most 0.1 s a frame, so the
      // vehicles barely reach the towers in the wait below: run the round on unseen first
      if (warp) console.log('battle: warped, vehicles', await p.evaluate((sec) => window.hedgerow.warp?.(window.hedgerow.game(), sec), warp))
      // plan item 676: shoot the fight, not a lull: wait (up to 20 s) for three towers attacking and a coin in the air
      // (and no banner over the field: 'Cath is level 2' stood over the l27 D frame)
      await p.waitForFunction(() => { const f = window.hedgerow.fx?.(); return !f || ((f.cues ?? f.attackers) >= 3 && f.coinsInAir >= 1 && !document.querySelector('.banner.show')) }, null, { timeout: 20000, polling: 100 }).catch(() => console.log('battle: no peak frame'))
      console.log('battle', JSON.stringify(await p.evaluate(() => window.hedgerow.fx?.())))
      await closeGuide()
    }
    await p.goto(`${base}/hedgerow/?2d`)
    await p.evaluate(([st, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 21: true, 27: true }, tips: t })), [stars(30), tips])
    await p.goto(`${base}/hedgerow/`); await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/hedge-menu-${s}.png` })
    for (const mode of (process.env.HG_MODES ?? '2d,3d').split(',')) {
      // plan item 676: level 27 (Brand Deal), not 21: On Air's influencers charm the towers near them, a quiet field by design
      await p.goto(`${base}/hedgerow/?sandbox=1&level=27${mode === '2d' ? '&2d' : ''}`)
      await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
      await p.waitForTimeout(mode === '2d' ? 1000 : 5000)
      await battle(mode === '3d' ? 7 : 0)
      await p.screenshot({ path: `${out}/hedge-l27-${mode}-${s}.png` })
    }
    await p.goto(`${base}/hedgerow/?sandbox=1&level=34&2d`)
    await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
    await p.waitForTimeout(1000); await battle(); await p.screenshot({ path: `${out}/hedge-l34-2d-${s}.png` })
  },
  async nightshift(p, s) {
    // Plan item 658: shoot at the quality a player gets ('auto': high on a desktop, the phone preset on a phone); the
    // desktop shots forced 'phone' (a low-res frame, FXAA, upscaled) and read 4.3x softer than a player's frame.
    await p.addInitScript((q) => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: q })), s === 'D' ? 'high' : 'phone')
    // Plan item 132: at 9 s under SwiftShader the loading poster (her back, the loading line at the foot) was still up and
    // read as a regression; the live street is drawn by about 30 s.
    await p.goto(`${base}/nightshift/`); await p.waitForTimeout(30000); await p.screenshot({ path: `${out}/ns-title-${s}.png` })
    // Plan item 223: at 15 s the pick's camera was still mid walk-down, Cath out of frame, and two critiques flagged
    // her as missing. Wait for the pick to set its class on the canvas, then for the walk-down to settle.
    await p.goto(`${base}/nightshift/?play`)
    await p.waitForFunction(() => document.querySelector('canvas')?.dataset.class, null, { timeout: 90000 }).catch(() => {})
    // Plan item 672: her quote is said word by word and under SwiftShader it was still mid-line at 15 s ('Nobody hears
    // the'), read as a cut quote: wait for the line to finish (the pick drops data-speaking when it has been said).
    await p.waitForTimeout(15000)
    await p.waitForFunction(() => !document.querySelector('[data-speaking]'), null, { timeout: 30000 }).catch(() => {})
    await p.screenshot({ path: `${out}/ns-play-${s}.png` })
    // Plan item 627: and the street in play, the HUD up (the pick is not play; critiques never saw the game itself). A
    // phone plays held sideways, so it turns first.
    if (s === 'P') await p.setViewportSize({ width: 844, height: 390 })
    // Plan item 673: at D the street is shot at full scale (as a desktop player sees it): a half-scale world drew the
    // rain as dark dashes over the lit windows, which no full-scale frame shows
    await p.goto(`${base}/nightshift/?play&class=ghost${s === 'D' ? '' : '&rs=0.5'}`)
    // A full-scale street can take over 200 s to draw its first frames under SwiftShader (2026-11-25: the D shot
    // caught the loading board at 91%), so wait up to 400 s.
    await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) >= 3, null, { timeout: 400000 }).catch(() => {})
    // Plan item 665: item 639 holds the weapon below the frame until her first input, and a critique read the
    // untouched arrival as 'nothing in hand': shoot the street as it plays, after an input.
    await p.evaluate(() => { if (window.cathode) window.cathode.input.forced = { reload: true } })
    await p.waitForTimeout(4000); await p.screenshot({ path: `${out}/ns-street-${s}.png` })
  },
}
for (const [name, job] of Object.entries(jobs)) {
  if (only && !only.includes(name)) continue
  for (const [s, o] of Object.entries(SIZES)) {
    // Plan item 364: NIGHT SHIFT's 3D renders at the screen's DPR (capped at 2 on phones), so a DPR-1 phone shot drew
    // Cath's 40 px face as a smear that a real phone never shows; its phone frames are shot at 2x (780 x 1688 images).
    // Plan item 691: Hedgerow's 3D does the same (DPR up to 2), so its phone frames are shot at 2x too (HG_DSF overrides).
    const dsf = name === 'nightshift' ? 2 : name === 'hedgerow' ? Number(process.env.HG_DSF ?? 2) : 1
    const ctx = await browser.newContext(s === 'P' && dsf !== 1 ? { ...o, deviceScaleFactor: dsf } : o)
    const p = await ctx.newPage()
    try { await job(p, s) } catch (e) { console.log(name, s, 'failed:', String(e).split('\n')[0]) }
    await ctx.close()
  }
  console.log(name, 'done')
}
await browser.close()
