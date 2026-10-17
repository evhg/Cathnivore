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
// C2 "Hits land on the body": the hit at 10 m, the head flinch 60 ms on, blood on the wall behind.
const C2 = ['hit-body', 'hit-head', 'hit-head@160', 'enemy-flinch-head-60', 'wall-splat@600', 'hit-kill@650']
// C3 "You can't miss the first gun", and a HUD sized for 5K: the first job's case and the HUD around it.
const C3 = ['pickup-first-from-takedown', 'pickup-prompt', 'objective-offscreen', 'hud-combat', 'pickup-taken@700']
const MS = { C1, C2, C3 }
const stages = process.argv.slice(2).length ? process.argv.slice(2) : MS[process.env.MILESTONE ?? 'C1'] ?? C1
// Stages that need the first job running (the tutorial is skipped in screenshots unless asked for).
const JOB_STAGES = new Set(C3.map((s) => s.split('@')[0]))
// C2's red-pixel probe: the share of rendered pixels within 0.2 m of the projected hit point that are
// red-dominant (the spec's "N", as a share so it holds at every render scale).
const RED_MIN = 0.1
const VIEWPORTS = {
  '5k': { viewport: { width: 2560, height: 1440 }, dsf: 2, q: '&rs=0.5' },
  d: { viewport: { width: 1440, height: 900 }, dsf: 1, q: '' },
  // The phone's blocked frame renders at full resolution: at rs=0.5 the crate and the guard's head over it blur
  // into one grey block and the brackets have no visible reason.
  phone: { viewport: { width: 844, height: 390 }, dsf: 3, q: '&rs=0.5&quality=phone', touch: true, stageQ: { blocked: '&rs=1&quality=phone' } },
  rm: { viewport: { width: 1440, height: 900 }, dsf: 1, q: '', reduced: true },
  portrait: { viewport: { width: 390, height: 844 }, dsf: 3, q: '&rs=0.5&quality=phone', touch: true },
}
// S0 budgets (docs/design/cathode-combat.md, performance table): draw calls and combat CPU per profile.
// Measured here in a calm street under SwiftShader, so they warn rather than fail until C-perf lands.
const BUDGET = { phone: { calls: 260, reflCalls: 120, particles: 1500 }, desktop: { calls: 600, particles: 4000 } }
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
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  let page = await ctx.newPage()
  let loadedQ = null
  const load = async (q) => {
    if (q === loadedQ) return
    // A fresh page per query: navigating away from a page mid-way through a multi-second SwiftShader frame can
    // stall the navigation for minutes.
    if (loadedQ !== null) {
      await page.close({ runBeforeUnload: false })
      page = await ctx.newPage()
    }
    loadedQ = q
    await page.goto(`${base}?play&shot${q}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
    await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) > 2 && typeof window.cathode?.stage === 'function', null, { timeout: 400_000 })
    await page.waitForTimeout(3000)
  }
  await load(V.q)
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
    const t = at ? Number(at) : stage === 'hit-kill' ? 230 : stage === 'enemy-flinch-head-60' ? 60 : 40
    await load((V.stageQ?.[stage] ?? V.q) + (JOB_STAGES.has(stage) ? '&job' : ''))
    const f0 = await page.evaluate(() => window.cathode.stats.frames)
    const cls = await page.evaluate(([s, tt]) => window.cathode.stage(s, tt), [stage, t])
    // SwiftShader draws about one frame a second: let two frames land so the HUD shows the stage.
    await page.waitForFunction((f) => window.cathode.stats.frames >= f + 3, f0, { timeout: 120_000 })
    await page.waitForTimeout(300)
    const file = `${out}/c-${stage}${at ? `-${at}` : ''}-${vp}`
    await page.screenshot({ path: `${file}.png`, timeout: 300_000 })
    // C2: where the round landed, the blood around it, and how far the head moved.
    const info = await page.evaluate(() => window.cathode.stageInfo ?? null)
    let probe = null
    if (info && /^(hit-body|hit-head|enemy-flinch|wall-splat)/.test(stage)) {
      probe = await page.evaluate(([x, y, r]) => window.cathode.probeRed(x, y, r), [info.hit.x, info.hit.y, info.r02])
      const cw2 = Math.round(Math.max(240, info.r02 * 18))
      const ch2 = Math.round(cw2 * 0.66)
      const cx = Math.max(0, Math.min(V.viewport.width - cw2, info.hit.x - cw2 / 2))
      const cy = Math.max(0, Math.min(V.viewport.height - ch2, info.hit.y - ch2 / 2))
      await page.screenshot({ path: `${file}-hit.png`, clip: { x: cx, y: cy, width: cw2, height: ch2 }, timeout: 300_000 })
    }
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
      const clusters = ['.hud-objective', '.hud-vitals', '.hud-arms', '.hud-feed-line', '.hud-sub', '.hud-target', '.hud-prompt', '.hud-threats > *', '.hud-wprompt', '.hud-toast', '.hud-teach.on',
        // C3: the off-screen chevron and its plate against everything, the touch controls included (a plate on FIRE).
        '.hud-wp:not([hidden]).off .hud-wp-arrow', '.hud-wp:not([hidden]).off .hud-wp-dist', '.tbtn', '.tbtn-menu', '.stick', '.look-hint:not(.gone)']
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
      // C3: every visible text in the HUD, its computed font size in CSS px.
      const texts = []
      for (const e of document.querySelectorAll('.hud-root *')) {
        if (e.closest('[hidden]') || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
        const b = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        if (b.width === 0 || cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue
        texts.push([e.className || e.tagName, parseFloat(cs.fontSize)])
      }
      const fontPx = (q) => {
        const e = document.querySelector(q)
        return e && !e.closest('[hidden]') ? parseFloat(getComputedStyle(e).fontSize) * d : null
      }
      return {
        texts,
        wpMark: r(document.querySelector('.hud-wp:not([hidden]) .hud-wp-mark')),
        // The marker's parts as drawn (opacity is the wrapper's: a faded, shrunk marker over the reticle is fine).
        wpParts: [...document.querySelectorAll('.hud-wp:not([hidden]) .hud-wp-mark, .hud-wp:not([hidden]) .hud-wp-dist')]
          .map((e) => ({ ...r(e), wpOpacity: Number(getComputedStyle(e.closest('.hud-wp')).opacity) }))
          .filter((b) => b.w > 0 && b.display !== 'none'),
        wpOff: document.querySelector('.hud-wp:not([hidden])')?.classList.contains('off') ?? false,
        wpArrow: r(document.querySelector('.hud-wp:not([hidden]).off .hud-wp-arrow')),
        wprompt: r(document.querySelector('.hud-wprompt:not([hidden])')),
        wpromptKey: r(document.querySelector('.hud-wprompt:not([hidden]) .c-key')),
        magFont: fontPx('.hud-mag'),
        mag: r(document.querySelector('.hud-mag')),
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
        ammo: document.querySelector('.hud-arms')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60),
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
    side.stageInfo = info
    side.probe = probe
    side.viewport = vp
    side.classShown = cls
    writeFileSync(`${file}.json`, JSON.stringify(side, null, 1))
    console.log(vp, spec, cls, 'hp', side.hp, 'tick', side.tick && `${Math.round(side.tick.ow)}x${Math.round(side.tick.oh)}`, 'ring', side.ring && Math.round(side.ring.ow), 'calls', side.stats.drawCalls, 'refl', side.stats.reflCalls, 'combatMs', side.stats.combatMs?.toFixed(2), 'particles', side.stats.particles)
    // ---- C2 acceptance ----
    if (probe && info) {
      const k = side.dpr
      const headPx = Math.hypot(info.head1.x - info.head0.x, info.head1.y - info.head0.y) * k
      console.log(`  C2 ${vp} ${spec}: mean rgb ${probe.mean}; red ${probe.red}/${probe.total} within ${Math.round(info.r02 * k)} physical px of the hit; head moved ${headPx.toFixed(1)} physical px`)
      // The burst past the marker (pillar 4): a ring from 0.2 m to 0.45 m around the hit, outside the X's ticks.
      if (/^(hit-body|hit-head)/.test(stage) && t <= 100) {
        const ring = await page.evaluate(([x, y, r, r0]) => window.cathode.probeRed(x, y, r, r0), [info.hit.x, info.hit.y, info.r02 * 2.25, info.r02])
        console.log(`  C2 ${vp} ${spec}: past the marker, red ${ring.red}/${ring.total} in the 0.2-0.45 m ring`)
        // Tracked, not yet a failure: the spurt measures 1.4 to 3% here at 40 ms (C2 fix); C9's hit-stop and
        // gore pass owns the burst past the marker.
        if (ring.red < 0.03 * ring.total) warn(`${vp} ${spec}: blood barely bursts past the marker (${ring.red}/${ring.total} red in the 0.2-0.45 m ring, < 3%)`)
      }
      if (/^(hit-body|hit-head|enemy-flinch)/.test(stage) && probe.red < RED_MIN * probe.total) fail(`${vp} ${spec}: only ${probe.red}/${probe.total} red pixels near the hit (< ${RED_MIN * 100}%)`)
      // The puff's drawn size at this moment (it has a mist alpha floor of 0.3), in physical px.
      const puffPx = info.puffM * (info.r02 / 0.2) * k
      console.log(`  C2 ${vp} ${spec}: puff ${puffPx.toFixed(0)} physical px`)
      if (vp === '5k' && /^(hit-body|hit-head)/.test(stage) && t <= 100 && puffPx < 40) fail(`${vp} ${spec}: the puff is ${puffPx.toFixed(0)} physical px (< 40)`)
      // 8 physical px at every size (1440x900 @1 is the tightest: there 8 px is about 0.13 m at 10 m).
      if (stage === 'enemy-flinch-head-60' && headPx < 8) fail(`${vp} ${spec}: the head moved ${headPx.toFixed(1)} px (< 8)`)
      // A head hit's marker frames the head instead of hiding it: its opaque ticks cover under 30% of the
      // projected head (a disc of the head's 0.13 m radius around where the head is now).
      if (/^(hit-head|enemy-flinch-head)/.test(stage) && t <= 100) {
        const cover = await page.evaluate(([hx, hy, hr]) => {
          const hit = document.querySelector('.hud-hit')
          const tick = hit?.querySelector('i')
          if (!hit || !tick || Number(getComputedStyle(hit).opacity) < 0.05) return 0
          const cs = getComputedStyle(tick)
          const len = parseFloat(cs.height)
          const th = parseFloat(cs.width) + 2
          const gap = -parseFloat(cs.top) - len
          const m = new DOMMatrix(getComputedStyle(hit).transform)
          const sc = Math.hypot(m.a, m.b) || 1
          const cx = innerWidth / 2
          const cy = innerHeight / 2
          let inside = 0
          let n = 0
          for (let y = -hr; y <= hr; y += 0.5)
            for (let x = -hr; x <= hr; x += 0.5) {
              if (x * x + y * y > hr * hr) continue
              n++
              const dx = (hx + x - cx) / sc
              const dy = (hy + y - cy) / sc
              // Four ticks on the diagonals, each from gap to gap+len out from the centre.
              for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
                const ux = Math.sin(a)
                const uy = -Math.cos(a)
                const rad = dx * ux + dy * uy
                const perp = Math.abs(-dx * uy + dy * ux)
                if (rad >= gap && rad <= gap + len && perp <= th / 2) {
                  inside++
                  break
                }
              }
            }
          return n ? inside / n : 0
        }, [info.head1.x, info.head1.y, info.r02 * 0.65])
        console.log(`  C2 ${vp} ${spec}: the head marker covers ${(cover * 100).toFixed(0)}% of the head`)
        if (cover > 0.3) fail(`${vp} ${spec}: the head marker covers ${(cover * 100).toFixed(0)}% of the head (> 30%)`)
      }
      // The wall splat: the best of its splats on screen must be big enough and read red, not pink.
      if (stage === 'wall-splat') {
        let best = null
        for (const sp of info.splats ?? []) {
          if (sp.x < 0 || sp.y < 0 || sp.x > V.viewport.width || sp.y > V.viewport.height) continue
          const pr = await page.evaluate(([x, y, r]) => window.cathode.probeRed(x, y, r), [sp.x, sp.y, Math.max(2, sp.r * 0.45)])
          const share = pr.red / Math.max(1, pr.total)
          if (!best || share > best.share) best = { share, px: sp.r * 2 * k, pr }
        }
        const minPx = V.viewport.height * k * 0.03
        console.log(`  C2 ${vp} ${spec}: ${info.splats?.length ?? 0} splats; best ${best ? `${(best.share * 100).toFixed(0)}% red (mean ${best.pr.mean}), ${best.px.toFixed(0)} physical px across` : 'none on screen'}`)
        if (!best) fail(`${vp} ${spec}: no wall splat on screen`)
        else {
          if (best.share < 0.2) fail(`${vp} ${spec}: the splat is only ${(best.share * 100).toFixed(0)}% red (< 20%)`)
          if (best.px < minPx) fail(`${vp} ${spec}: the splat is ${best.px.toFixed(0)} physical px (< ${minPx.toFixed(0)}, 3% of the screen height)`)
          const [r, g, b] = best.pr.mean
          if (g > r * 0.6 && b > r * 0.6 && best.share < 0.3) warn(`${vp} ${spec}: the splat reads pink (mean ${best.pr.mean})`)
        }
      }
    }
    // The kill, 650 ms on: the body is down and must still catch the eye (the death glow on its rim).
    if (stage === 'hit-kill' && t >= 400 && info?.corpse) {
      const c = info.corpse.chest
      const p = info.corpse.pelvis
      const pr = await page.evaluate(([x, y, r]) => window.cathode.probeRed(x, y, r), [(c.x + p.x) / 2, (c.y + p.y) / 2, Math.max(4, info.r02 * 1.2)])
      const share = pr.red / Math.max(1, pr.total)
      console.log(`  C2 ${vp} ${spec}: the body reads ${(share * 100).toFixed(0)}% red (mean ${pr.mean}) around its torso`)
      // Measured on an open street the falling body's red rim fills 6 to 10% of the disc (the loot glint and grey
      // street fill the rest); a black body on black asphalt read 0%. The glow cuts through the fog, so this
      // fails at every size, the phone's thick haze included.
      if (share < 0.05) fail(`${vp} ${spec}: the dead body doesn't show (${(share * 100).toFixed(0)}% red around it, < 5%)`)
      const cw3 = Math.round(Math.max(240, info.r02 * 18))
      const ch3 = Math.round(cw3 * 0.66)
      const x3 = Math.max(0, Math.min(V.viewport.width - cw3, (c.x + p.x) / 2 - cw3 / 2))
      const y3 = Math.max(0, Math.min(V.viewport.height - ch3, (c.y + p.y) / 2 - ch3 / 2))
      await page.screenshot({ path: `${file}-body.png`, clip: { x: x3, y: y3, width: cw3, height: ch3 }, timeout: 300_000 })
    }
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
    // Stages never leak into each other: the kill ring shows only on a kill (S0 stage hygiene).
    if (stage.startsWith('hit-') && !/kill/.test(stage) && side.ring && side.ring.opacity > 0.01) fail(`${vp} ${spec}: a kill ring shows on a non-kill stage (opacity ${side.ring.opacity})`)
    if (stage === 'blocked' && side.ring && side.ring.opacity > 0.01) fail(`${vp} blocked: a kill ring shows`)
    // The bar collapses for real (180 ms flash + 400 ms fade): gone by 600 ms.
    if (stage === 'hit-kill' && t >= 600 && !side.targetHidden) fail(`${vp} ${spec}: target bar still showing`)
    // Every stage starts clean: full health, no hurt arc from before.
    if (side.arcA > 0.05) fail(`${vp} ${spec}: a stale hurt arc shows (--a ${side.arcA})`)
    if (side.spill.length) fail(`${vp} ${spec}: HUD past the screen edge: ${side.spill.slice(0, 4).join('; ')}`)
    // The objective marker never sits on the reticle at full strength (S7.2): over it, it must have stepped back.
    for (const g of side.wpParts ?? [])
      for (const a of side.arms) {
        const ov = Math.max(0, Math.min(a.x + a.w, g.x + g.w) - Math.max(a.x, g.x)) * Math.max(0, Math.min(a.y + a.h, g.y + g.h) - Math.max(a.y, g.y))
        // Drawn strength: the wrapper's opacity times the part's own (the plate hides over the reticle).
        const op = g.visibility === 'hidden' ? 0 : g.wpOpacity * g.opacity
        if (ov > 1 && op > 0.5) fail(`${vp} ${spec}: the objective marker covers a crosshair arm at opacity ${op.toFixed(2)}`)
      }
    for (const [q, g] of side.glyphs)
      for (const a of side.arms) {
        const ov = Math.max(0, Math.min(a.x + a.w, g.x + g.w) - Math.max(a.x, g.x)) * Math.max(0, Math.min(a.y + a.h, g.y + g.h) - Math.max(a.y, g.y))
        if (ov > 1) fail(`${vp} ${spec}: a crosshair arm crosses ${q}`)
      }
    // ---- C3 acceptance ----
    if (stage === 'pickup-first-from-takedown') {
      const c = info?.caseAt
      const off = c ? Math.abs(c.x - V.viewport.width / 2) / (V.viewport.width / 2) : 1
      console.log(`  case on screen at ${c ? `${Math.round(c.x)},${Math.round(c.y)}` : 'none'} (${(off * 100).toFixed(0)}% of the half-width off centre)`)
      if (!c?.front || off > 0.3) fail(`${vp} ${spec}: the first gun's case is ${(off * 100).toFixed(0)}% off centre (> 30%) or not in view`)
      if (vp === '5k' && !(side.wpMark && side.wpMark.oh >= 48)) fail(`${vp} ${spec}: waypoint diamond ${side.wpMark?.oh?.toFixed(0)} < 48 physical px`)
      // The beam has to read, not just be in frame: probe its projected column against the street either side.
      const bm = info?.beam
      if (!bm) fail(`${vp} ${spec}: no beam to probe`)
      else {
        const lum = (m) => 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]
        const r = Math.max(1.5, bm.r * 0.7)
        let on = 0
        let offs = 0
        let n = 0
        for (const t of [0.1, 0.25, 0.4, 0.55]) {
          const x = bm.x0 + (bm.x1 - bm.x0) * t
          const y = bm.y0 + (bm.y1 - bm.y0) * t
          const c = await page.evaluate(([a, b, rr]) => window.cathode.probeRed(a, b, rr).mean, [x, y, r])
          const sd = Math.max(8, bm.r * 5)
          const l = await page.evaluate(([a, b, rr]) => window.cathode.probeRed(a, b, rr).mean, [x - sd, y, r])
          const rt = await page.evaluate(([a, b, rr]) => window.cathode.probeRed(a, b, rr).mean, [x + sd, y, r])
          on += lum(c)
          offs += Math.max(lum(l), lum(rt))
          n++
        }
        on /= n
        offs /= n
        // Mean luminance on the beam against the brighter side, 0-255: it must stand out by a clear step.
        console.log(`  beam luminance ${on.toFixed(0)} against ${offs.toFixed(0)} beside it (half-width ${bm.r.toFixed(1)} CSS px)`)
        if (on < offs * 1.3 + 12) fail(`${vp} ${spec}: the beam doesn't read (luminance ${on.toFixed(0)} on it, ${offs.toFixed(0)} beside it)`)
      }
    }
    if (stage === 'pickup-prompt') {
      if (!side.wprompt) fail(`${vp} ${spec}: no world prompt on the case`)
      else if (vp === '5k' && !(side.wpromptKey && side.wpromptKey.oh >= 58)) fail(`${vp} ${spec}: prompt keycap ${side.wpromptKey?.oh?.toFixed(0)} < 58 physical px`)
    }
    if (stage === 'objective-offscreen' && !(side.wpOff && side.wpArrow && side.wpArrow.w > 0)) fail(`${vp} ${spec}: no off-screen arrow for the case`)
    if (stage === 'hud-combat') {
      if (vp === '5k' && !(side.mag && side.mag.h >= 150)) fail(`${vp} ${spec}: ammo numerals ${side.mag?.h?.toFixed(0)} < 150 physical px`)
      if (vp === '5k' && !(side.wpMark && side.wpMark.oh >= 48)) fail(`${vp} ${spec}: waypoint diamond ${side.wpMark?.oh?.toFixed(0)} < 48 physical px`)
    }
    if (JOB_STAGES.has(stage)) {
      console.log(`  diamond ${side.wpMark?.oh?.toFixed(0) ?? '-'} keycap ${side.wpromptKey?.oh?.toFixed(0) ?? '-'} ammo ${side.mag?.h?.toFixed(0) ?? '-'} (physical px); smallest text ${Math.min(...side.texts.map((t) => t[1])).toFixed(1)} CSS px`)
      if (vp === 'phone') for (const [q, px] of side.texts) if (px < 11.95) fail(`${vp} ${spec}: ${q} text is ${px.toFixed(1)} CSS px (< 12)`)
    }
    const B = BUDGET[side.quality]
    if (side.stats.drawCalls > B.calls) warn(`${vp} ${spec}: ${side.stats.drawCalls} draw calls > ${B.calls} (${side.quality})`)
    // The mirror pass culls small meshes on phone (render/reflection.ts): that share of the budget fails hard.
    if (side.quality === 'phone' && (side.stats.reflCalls ?? 0) > B.reflCalls) fail(`${vp} ${spec}: the reflection pass took ${side.stats.reflCalls} draw calls > ${B.reflCalls}`)
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
