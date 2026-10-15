// Phase C screenshot runner (docs/design/cathode-combat.md S0): shoots CATHODE's combat stages at the three
// sizes every milestone is judged at, writes a JSON sidecar of DOM sizes (x DPR) and render stats next to each
// image, and fails when a milestone's size, presence or overlap check fails.
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-feel-shots.mjs [stage ...]
//
// Env: CATHODE_URL (default http://localhost:4180/cathode/), OUT (default e2e/screenshots), VPS=5k,d,phone
// (also: rm = 1440x900 with reduced motion; portrait = 390x844, which only checks the rotate card).
// A stage can carry its own time: hit-kill@650 shoots the kill 650 ms after the round.
// Kill any stale :4173/:4180 preview first (CLAUDE.md): a reused server can serve old assets.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/cathode/'
const out = process.env.OUT ?? 'e2e/screenshots'
mkdirSync(out, { recursive: true })
const C1 = ['hit-body', 'hit-head', 'hit-kill', 'hit-kill@650', 'hit-soft', 'blocked', 'cover-debug-market']
const stages = process.argv.slice(2).length ? process.argv.slice(2) : C1
const VIEWPORTS = {
  '5k': { viewport: { width: 2560, height: 1440 }, dsf: 2, q: '&rs=0.5' },
  d: { viewport: { width: 1440, height: 900 }, dsf: 1, q: '' },
  phone: { viewport: { width: 844, height: 390 }, dsf: 3, q: '&rs=0.5&quality=phone', touch: true },
  rm: { viewport: { width: 1440, height: 900 }, dsf: 1, q: '', reduced: true },
  portrait: { viewport: { width: 390, height: 844 }, dsf: 3, q: '&rs=0.5&quality=phone', touch: true },
}
// S0 budgets (docs/design/cathode-combat.md, performance table): draw calls and combat CPU per profile.
// Measured here in a calm street under SwiftShader, so they warn rather than fail until C-perf lands.
const BUDGET = { phone: { calls: 260, particles: 1500 }, desktop: { calls: 600, particles: 4000 } }
const warnings = []
const warn = (msg) => {
  warnings.push(msg)
  console.log('  WARN', msg)
}
const vps = (process.env.VPS ?? '5k,d,phone').split(',')
const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.log('  FAIL', msg)
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
for (const vp of vps) {
  const V = VIEWPORTS[vp]
  const ctx = await browser.newContext({ viewport: V.viewport, deviceScaleFactor: V.dsf, hasTouch: !!V.touch, isMobile: !!V.touch, reducedMotion: V.reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  await page.goto(`${base}?play&shot${V.q}`)
  await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) > 2 && typeof window.cathode?.stage === 'function', null, { timeout: 240_000 })
  await page.waitForTimeout(3000)
  if (vp === 'portrait') {
    // Upright, the game asks for the phone to be turned: the HUD isn't measured.
    const card = await page.evaluate(() => {
      const r = document.querySelector('.rotate')
      const b = r?.getBoundingClientRect()
      return !!b && b.width > innerWidth * 0.9 && b.height > innerHeight * 0.9 && getComputedStyle(r).display !== 'none' && Number(getComputedStyle(r).opacity) > 0.5
    })
    await page.screenshot({ path: `${out}/c-portrait.png`, timeout: 300_000 })
    console.log(vp, card ? 'rotate card covers the screen' : 'no rotate card')
    if (!card) fail('portrait: the "turn your phone sideways" card is not covering the screen')
    await ctx.close()
    continue
  }
  for (const spec of stages) {
    const [stage, at] = spec.split('@')
    const t = at ? Number(at) : stage === 'hit-kill' ? 230 : 40
    const f0 = await page.evaluate(() => window.cathode.stats.frames)
    const cls = await page.evaluate(([s, tt]) => window.cathode.stage(s, tt), [stage, t])
    // SwiftShader draws about one frame a second: let two frames land so the HUD shows the stage.
    await page.waitForFunction((f) => window.cathode.stats.frames >= f + 3, f0, { timeout: 120_000 })
    await page.waitForTimeout(300)
    const file = `${out}/c-${stage}${at ? `-${at}` : ''}-${vp}`
    await page.screenshot({ path: `${file}.png`, timeout: 300_000 })
    // A close crop around the crosshair, for judging the marker itself.
    const cw = Math.round(V.viewport.width * 0.22)
    const ch = Math.round(V.viewport.height * 0.22)
    await page.screenshot({ path: `${file}-crop.png`, clip: { x: V.viewport.width / 2 - cw / 2, y: V.viewport.height / 2 - ch / 2, width: cw, height: ch }, timeout: 300_000 })
    const side = await page.evaluate(() => {
      const d = devicePixelRatio
      const r = (el) => {
        if (!el) return null
        const b = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return { x: b.x * d, y: b.y * d, w: b.width * d, h: b.height * d, ow: el.offsetWidth * d, oh: el.offsetHeight * d, opacity: Number(cs.opacity), display: cs.display, visibility: cs.visibility }
      }
      const hit = document.querySelector('.hud-hit')
      const info = window.cathode.world.renderer.info
      const shown = (b) => b && b.w > 0 && b.h > 0 && b.opacity > 0.05 && b.display !== 'none' && b.visibility !== 'hidden'
      // The hurt arc is a full ring around the centre: only its lit part counts (its --a, not its box).
      const arcA = Number(getComputedStyle(document.querySelector('.hud-hurt-arc') ?? document.body).getPropertyValue('--a') || 0)
      const clusters = ['.hud-objective', '.hud-vitals', '.hud-arms', '.hud-feed', '.hud-sub', '.hud-target', '.hud-prompt', '.hud-threats > *']
        .flatMap((q) => [...document.querySelectorAll(q)].map((e) => [q, r(e)]))
        .filter(([, b]) => shown(b))
      // Anything in the HUD past the window's edges (a nowrap label spilling out of its cluster).
      const W = innerWidth
      const H = innerHeight
      const spill = []
      for (const e of document.querySelectorAll('.hud-root *')) {
        const b = e.getBoundingClientRect()
        if (b.width === 0 || b.height === 0 || e.closest('[hidden]')) continue
        const cs = getComputedStyle(e)
        if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || cs.position === 'fixed') continue
        if (e.closest('.hud-hurt-arc, .hud-vignette, .hud-threats, .hud-focus, .hud-scope')) continue
        if (b.right > W + 0.5 || b.left < -0.5 || b.bottom > H + 0.5 || b.top < -0.5) spill.push(`${e.className || e.tagName} [${Math.round(b.left)},${Math.round(b.right)}]`)
        if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible' && e.clientWidth > 0) spill.push(`${e.className} scroll ${e.scrollWidth}>${e.clientWidth}`)
      }
      // The crosshair's arms (while lit) against the marker and the blocked glyph and word.
      const arms = [...document.querySelectorAll('.hud-cross span:not(.hud-cross-dot)')]
        .filter((e) => Number(getComputedStyle(e).opacity) > 0.3 && !e.closest('[hidden]'))
        .map((e) => r(e))
      const glyphs = ['.hud-blocked-l', '.hud-blocked-r', '.hud-blocked-word']
        .map((q) => [q, r(document.querySelector(q))])
        .filter(([, b]) => shown(b) && Number(getComputedStyle(document.querySelector('.hud-blocked')).opacity) > 0.05)
      return {
        dpr: d,
        hitClass: window.cathode.hud?.hitClass ?? null,
        hit: r(hit),
        tick: r(hit?.querySelector('i')),
        ring: r(hit?.querySelector('.hud-hit-ring')),
        blocked: r(document.querySelector('.hud-blocked')),
        bracket: r(document.querySelector('.hud-blocked-l')),
        target: r(document.querySelector('.hud-target')),
        targetHidden: document.querySelector('.hud-target')?.hidden ?? true,
        clusters,
        arcA,
        spill,
        arms,
        glyphs,
        hp: document.querySelector('.hud-hp-text')?.textContent,
        quality: new URLSearchParams(location.search).get('quality') === 'phone' ? 'phone' : 'desktop',
        stats: {
          frames: window.cathode.stats.frames,
          ms: window.cathode.stats.ms,
          drawCalls: info.render.calls,
          tris: info.render.triangles,
          combatMs: window.cathode.stats.combatMs ?? null,
          particles: window.cathode.stats.particles ?? null,
          voices: null, // the audio graph has no voice count yet (C11)
          reflCalls: window.cathode.world.perf?.reflCalls ?? null,
          shadowed: window.cathode.world.perf?.shadowed ?? null,
        },
      }
    })
    side.stage = stage
    side.t = t
    side.viewport = vp
    side.classShown = cls
    writeFileSync(`${file}.json`, JSON.stringify(side, null, 1))
    console.log(vp, spec, cls, 'hp', side.hp, 'tick', side.tick && `${Math.round(side.tick.ow)}x${Math.round(side.tick.oh)}`, 'ring', side.ring && Math.round(side.ring.ow), 'calls', side.stats.drawCalls, 'refl', side.stats.reflCalls, 'combatMs', side.stats.combatMs?.toFixed(2), 'particles', side.stats.particles)
    // ---- C1 acceptance ----
    // Sizes and presence while the marker holds (a later frame, like hit-kill@650, has rightly faded it).
    if (stage.startsWith('hit-') && vp === '5k' && t < 400) {
      if (!(side.tick && side.tick.ow >= 6 && side.tick.oh >= 26)) fail(`${vp} ${stage}: tick ${side.tick?.ow}x${side.tick?.oh} < 6x26 physical`)
      if (side.hit.opacity < 0.5) fail(`${vp} ${stage}: marker not showing`)
    }
    if (stage === 'hit-kill' && t < 400) {
      if (vp === '5k' && !(side.ring && side.ring.ow >= 100)) fail(`${vp} hit-kill: kill ring ${side.ring?.ow} < 100 physical px`)
      // Reduced motion keeps the ring as a fade: it must still show.
      if (!(side.ring && side.ring.opacity > 0.3)) fail(`${vp} hit-kill: no kill ring (opacity ${side.ring?.opacity})`)
    }
    // The bar collapses for real (180 ms flash + 400 ms fade): gone by 600 ms.
    if (stage === 'hit-kill' && t >= 600 && !side.targetHidden) fail(`${vp} ${spec}: target bar still showing`)
    // Every stage starts clean: full health, no hurt arc from before.
    if (side.arcA > 0.05) fail(`${vp} ${spec}: a stale hurt arc shows (--a ${side.arcA})`)
    if (side.spill.length) fail(`${vp} ${spec}: HUD past the screen edge: ${side.spill.slice(0, 4).join('; ')}`)
    for (const [q, g] of side.glyphs)
      for (const a of side.arms) {
        const ov = Math.max(0, Math.min(a.x + a.w, g.x + g.w) - Math.max(a.x, g.x)) * Math.max(0, Math.min(a.y + a.h, g.y + g.h) - Math.max(a.y, g.y))
        if (ov > 1) fail(`${vp} ${spec}: a crosshair arm crosses ${q}`)
      }
    const B = BUDGET[side.quality]
    if (side.stats.drawCalls > B.calls) warn(`${vp} ${spec}: ${side.stats.drawCalls} draw calls > ${B.calls} (${side.quality})`)
    if ((side.stats.particles ?? 0) > B.particles) warn(`${vp} ${spec}: ${side.stats.particles} particles > ${B.particles}`)
    if (stage === 'blocked') {
      if (side.hit.opacity > 0.01) fail(`${vp} blocked: a hit marker showed`)
      if (!(side.blocked.opacity > 0.5 && side.bracket.ow > 0)) fail(`${vp} blocked: no bracket glyph`)
    }
    if (vp === 'phone' || vp === '5k' || vp === 'd') {
      const cl = side.clusters
      for (let i = 0; i < cl.length; i++)
        for (let j = i + 1; j < cl.length; j++) {
          const [qa, a] = cl[i]
          const [qb, b] = cl[j]
          if (qa === qb) continue
          const ov = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
          if (ov > 4 * side.dpr * side.dpr) fail(`${vp} ${stage}: ${qa} overlaps ${qb} (${Math.round(ov)} px²)`)
        }
    }
  }
  await ctx.close()
}
await browser.close()
if (warnings.length) console.log(`\n${warnings.length} budget warning(s)`)
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
