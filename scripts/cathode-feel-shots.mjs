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
// C4 "Kestrel 9, built like a real gun": the pistol at rest, aimed down the dot, and mid-inspect.
const C4 = ['pistol-idle', 'pistol-ads', 'pistol-inspect@900', 'pistol-alley']
// C5 "Kestrel 9 in motion": the shot at 0, 20 and 45 ms, the lock, the reload at 400 and 930 ms, the draw at
// 140 ms (mid-rise) and 300 ms (idle first: fire-0's muzzle is judged against it). C5X are the review extras (the empty reload past
// its seat, the hero draw's rack, the press-check, an aimed shot).
const C5 = ['pistol-idle', 'pistol-fire@0', 'pistol-fire@20', 'pistol-fire@45', 'pistol-lock', 'pistol-reload@400', 'pistol-reload@930', 'pistol-draw@140', 'pistol-draw@300']
const C5X = ['pistol-reload-cancel@0', 'pistol-reload-cancel@60', 'pistol-reload-cancel@150', 'pistol-presscheck-cancel@60', 'pistol-reload-empty@1300', 'pistol-reload-empty@1470', 'pistol-hero@340', 'pistol-presscheck@700', 'pistol-fire-ads@0', 'pistol-reload@200', 'pistol-reload@700']
// C6 "I know I'm hit": a hit from 90 degrees (100 ms on), one from behind, the Guard break, a live grenade
// near; C6X are the review extras (a melee hit, a hit in critical with the clutch).
const C6 = ['player-hurt-100@100', 'player-hurt-behind@100', 'vitals-guardbreak@100', 'grenade-near@0']
const C6X = ['player-hurt-melee@60', 'player-hurt-critical@200', 'player-hurt-100@700']
// C7 "Wounded": the four states of the wounded loop (hurt, critical on the beat, bleeding out, Guard coming back).
const C7 = ['vitals-hurt@0', 'vitals-critical@250', 'vitals-bleeding@400', 'vitals-regen@300']
// C8 "Dying, done properly": the fall at 400 ms, on the floor at 1200 ms with the killer framed, frozen in the ink
// at 2000 ms, the death card, the re-sync's glitch (420 ms into it) and its fade up into the checkpoint (700 ms).
// Run VPS=rv for the reduced-violence death-2000 (no blood red anywhere in the frame).
const C8 = ['death-400', 'death-1200', 'death-2000', 'death-card', 'resync@420', 'resync-in@700']
// C9 "Deaths that land": four of the eight deaths at their telling moment, framed on the body at 4.6 m, and the
// pool 8 s on (the neon must show in it: a highlight probe). VPS=rv checks reduced violence leaves no pool.
const C9 = ['death-gutclutch-450', 'death-wallslump-1200', 'death-headshot-300', 'death-spin-400', 'blood-pool-8s']
const MS = { C1, C2, C3, C4, C5, C5X, C6, C6X, C7, C8, C9 }
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
  // C8: reduced violence (the 18+ gate's other choice) at the desktop size.
  rv: { viewport: { width: 1440, height: 900 }, dsf: 1, q: '', intensity: 'reduced' },
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
// C5: each size's idle muzzle luminance, for the fire-0 comparison.
const idleMuzzle = {}
// C7: each size's four histograms, compared pairwise once the size is done.
const C7_HIST_MIN = 0.12
const c7Hist = {}
const C7_SAT_EDGE = 0.8
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
  await ctx.addInitScript((intensity) => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity })), V.intensity ?? 'full')
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
    const t = at ? Number(at) : stage === 'hit-kill' ? 230 : stage === 'enemy-flinch-head-60' ? 60 : stage.startsWith('pistol-') ? 0 : 40
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
      const arcA = Number(getComputedStyle(document.querySelector('.hud-dmg') ?? document.body).getPropertyValue('--a') || 0)
      // C6: the strongest damage arc, measured in the ring's own units: its thickness down its centre line
      // (scanning the fill), its radius, and its rotation; the chevrons, the grenade glyph, the Guard bar.
      const ringBox = document.querySelector('.hud-dmg-ring')
      let dmg = null
      if (ringBox) {
        // 1u of the ring in CSS px (the ring box is 520u square), and the ring's own centre on screen.
        const rb = ringBox.getBoundingClientRect()
        const k = rb.width / 520
        const arcs = [...document.querySelectorAll('.hud-dmg-arc')].map((g) => [g, Number(getComputedStyle(g).opacity)]).sort((a, b) => b[1] - a[1])
        const [g, a] = arcs[0] ?? [null, 0]
        if (g && a > 0.05) {
          const body = g.querySelector('.body')
          const svgEl = g.querySelector('svg')
          let lo = null
          let hi = null
          const pt = svgEl.createSVGPoint()
          // Down the arc's centre line, in the ring's units (the art sits 190u below the SVG's origin).
          for (let y = -260; y <= -120; y += 0.1) {
            pt.x = 0
            pt.y = y
            if (body.isPointInFill(pt)) {
              if (lo === null) lo = y
              hi = y
            }
          }
          const sc = Number(getComputedStyle(g).getPropertyValue('--s') || 1)
          const bb = body.getBoundingClientRect()
          const rotDeg = parseFloat(getComputedStyle(g).getPropertyValue('--rot'))
          const tx = Number(getComputedStyle(g).getPropertyValue('--tx'))
          const ty = Number(getComputedStyle(g).getPropertyValue('--ty'))
          dmg = {
            a,
            rotDeg,
            thickPx: lo === null ? 0 : (hi - lo) * k * sc * d,
            // The ring's height radius (190u), and this arc's distance out from the crosshair.
            radiusFrac: (190 * k) / innerHeight,
            outFrac: (Math.hypot(tx, ty) * k) / innerHeight,
            core: g.classList.contains('is-core'),
            box: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
          }
        }
      }
      const optic = window.cathode.opticProbe?.() ?? null
      const chevs = [...document.querySelectorAll('.hud-dmg-chev')].filter((e) => Number(getComputedStyle(e).opacity) > 0.3).map((e) => ({ bottom: e.classList.contains('at-bottom'), top: e.classList.contains('at-top'), ...r(e) }))
      const nade = [...document.querySelectorAll('.hud-dmg-nade')].map((e) => Number(getComputedStyle(e).opacity)).reduce((m, v) => Math.max(m, v), 0)
      const vbar = document.querySelector('.hud-vbar')
      const vitals = vbar ? { broken: vbar.classList.contains('is-broken'), shards: !!document.querySelector('.hud-shards.go'), guard: r(document.querySelector('.hud-guard')), flesh: r(document.querySelector('.hud-hp')) } : null
      const wt = document.querySelector('.hud-wound')
      const wound = wt ? { critical: wt.classList.contains('is-critical') && /critical/i.test(wt.textContent), bleeding: wt.classList.contains('is-bleeding') && /bleeding/i.test(wt.textContent) } : null
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
        if (e.closest('.hud-dmg, .hud-shards, .hud-vignette, .hud-threats, .hud-focus, .hud-scope')) continue
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
        wound,
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
        dmg,
        optic,
        chevs,
        nade,
        vitals,
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
    // C4: the viewmodel mask (hands' share of its pixels) and the slide's exposure.
    // C4 review: the viewmodel never sits on a HUD cluster (the ammo block, the vitals, the thumb buttons): the
    // share of each cluster's box the gun or the hands cover, from the same mask.
    const VM_CLEAR = ['.hud-weapon', '.hud-ammo', '.hud-vitals', '.tbtn']
    if (stage.startsWith('pistol-')) {
      const boxes = await page.evaluate((qs) => qs.flatMap((q) => [...document.querySelectorAll(q)].filter((e) => {
        const cs = getComputedStyle(e)
        const b = e.getBoundingClientRect()
        return b.width > 0 && b.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && !e.closest('[hidden]')
      }).map((e) => {
        const b = e.getBoundingClientRect()
        return { q: q + (e.className && q === '.tbtn' ? `.${String(e.className).split(' ').slice(1).join('.')}` : ''), x: b.x, y: b.y, w: b.width, h: b.height }
      })), VM_CLEAR)
      side.vm = await page.evaluate((bs) => window.cathode.vmProbe?.(bs) ?? null, boxes)
      if (side.vm) side.vm.clear = boxes.map((b, i) => [b.q, side.vm.inRects?.[i] ?? 0])
    }
    // C4: aimed, the red dot sits on the point of aim (within 2 physical px of the screen centre).
    if (stage === 'pistol-ads') {
      side.dot = await page.evaluate(() => window.cathode.dotProbe?.() ?? null)
      if (!side.dot) fail(`${vp} ${spec}: no red dot to probe`)
      else {
        const off = Math.hypot(side.dot.x - side.dot.cx, side.dot.y - side.dot.cy) * side.dpr
        console.log(`  C4 ${vp} ${spec}: the dot is ${off.toFixed(1)} physical px from the centre (aim ${side.dot.aim.toFixed(3)})`)
        if (off > 2) fail(`${vp} ${spec}: the red dot is ${off.toFixed(1)} physical px off the point of aim (> 2)`)
      }
    }
    side.stage = stage
    side.t = t
    side.stageInfo = info
    side.probe = probe
    side.viewport = vp
    side.classShown = cls
    writeFileSync(`${file}.json`, JSON.stringify(side, null, 1))
    console.log(vp, spec, cls, 'hp', side.hp, 'tick', side.tick && `${Math.round(side.tick.ow)}x${Math.round(side.tick.oh)}`, 'ring', side.ring && Math.round(side.ring.ow), 'calls', side.stats.drawCalls, 'refl', side.stats.reflCalls, 'combatMs', side.stats.combatMs?.toFixed(2), 'particles', side.stats.particles)
    // ---- C5 acceptance ----
    side.pistol = await page.evaluate(() => window.cathode.pistolInfo ?? null)
    const pi = side.pistol
    if (pi && stage.startsWith('pistol-')) {
      // The muzzle region's mean luminance (0-255) in a 0.05 m disc round the muzzle on screen.
      const lum = (m) => 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]
      const pr = await page.evaluate(([x, y, r]) => window.cathode.probeRed(x, y, r).mean, [pi.muzzle.x, pi.muzzle.y, Math.max(3, pi.muzzleR05)])
      side.muzzleLum = lum(pr)
      if (stage === 'pistol-idle') idleMuzzle[vp] = side.muzzleLum
      console.log(`  C5 ${vp} ${spec}: slide ${pi.slideMm.toFixed(1)} mm (${(pi.slidePx * side.dpr).toFixed(1)} physical px), stop ${pi.stopDeg.toFixed(1)}°, hammer ${pi.hammerDeg.toFixed(0)}°, mag off ${pi.magOffMm.toFixed(1)} mm${pi.magVisible ? '' : ' (hidden)'}, top round ${pi.magRound}, chamber ${pi.chamberRound}, puff ${pi.flashOn ? `${(pi.puffM * 100).toFixed(1)} cm` : 'off'}, smoke ${pi.smoke}, muzzle lum ${side.muzzleLum.toFixed(0)}, ammo ${pi.ammo.mag}/${pi.ammo.reserve}${pi.reload ? `, ${pi.reload} reload ${pi.reloadMs.toFixed(0)} ms${pi.committed ? ' committed' : ''}` : ''}`)
      if (stage === 'pistol-fire' && t === 0) {
        if (!pi.flashOn) fail(`${vp} ${spec}: no muzzle puff on the shot`)
        if (pi.puffM > 0.1) fail(`${vp} ${spec}: the muzzle flash is ${(pi.puffM * 100).toFixed(1)} cm across (> 10 cm)`)
        if (idleMuzzle[vp] != null && !(side.muzzleLum > idleMuzzle[vp] + 4)) fail(`${vp} ${spec}: the muzzle region (lum ${side.muzzleLum.toFixed(0)}) doesn't beat idle (${idleMuzzle[vp].toFixed(0)})`)
      }
      if (stage === 'pistol-fire' && t === 20) {
        if (pi.slideMm < 18) fail(`${vp} ${spec}: the slide is only ${pi.slideMm.toFixed(1)} mm back at 20 ms (< 18)`)
        if (pi.slidePx * side.dpr < 4) fail(`${vp} ${spec}: the slide's travel is ${(pi.slidePx * side.dpr).toFixed(1)} physical px on screen (< 4)`)
        // The phone holds the puff a second frame (S2.3: 2 frames below 50 fps; 30 fps there).
        if (pi.flashOn && vp !== 'phone') fail(`${vp} ${spec}: the puff still shows at 20 ms`)
      }
      if (stage === 'pistol-fire' && t === 45 && !(pi.slideMm > 0.5 && pi.slideMm < 24)) fail(`${vp} ${spec}: the slide should be on its way home at 45 ms (${pi.slideMm.toFixed(1)} mm)`)
      if (stage === 'pistol-lock') {
        if (pi.stopDeg < 11) fail(`${vp} ${spec}: the slide stop is down (${pi.stopDeg.toFixed(1)}°)`)
        if (pi.slideMm < 23.5) fail(`${vp} ${spec}: the slide isn't locked back (${pi.slideMm.toFixed(1)} mm)`)
        if (pi.chamberRound || pi.magRound) fail(`${vp} ${spec}: a round shows on an empty gun (chamber ${pi.chamberRound}, mag ${pi.magRound})`)
      }
      if (stage === 'pistol-reload' && t === 930 && !(pi.magOffMm < 1 && pi.magVisible && pi.committed)) fail(`${vp} ${spec}: the mag isn't seated at 930 ms (${pi.magOffMm.toFixed(1)} mm off, committed ${pi.committed})`)
      if (stage === 'pistol-reload' && t === 400 && !(pi.magOffMm > 20 && !pi.committed)) fail(`${vp} ${spec}: the old mag should be well out at 400 ms (${pi.magOffMm.toFixed(1)} mm)`)
      if (stage === 'pistol-draw' && !(pi.drawMs > 0)) fail(`${vp} ${spec}: no draw playing`)
    }
    // ---- C4 acceptance ----
    if (side.vm) {
      console.log(`  C4 ${vp} ${spec}: hands ${(side.vm.handShare * 100).toFixed(1)}% of ${side.vm.vmPx} viewmodel px; slide luminance ${side.vm.slideLum.toFixed(3)} over ${side.vm.slidePx} px`)
      if (stage === 'pistol-idle' && side.vm.handShare < 0.25) fail(`${vp} ${spec}: hands are ${(side.vm.handShare * 100).toFixed(1)}% of the viewmodel (< 25%)`)
      if ((stage === 'pistol-idle' || stage === 'pistol-ads' || stage === 'pistol-alley') && side.vm.slideLum < 0.08) fail(`${vp} ${spec}: slide luminance ${side.vm.slideLum.toFixed(3)} (< 0.08)`)
      if (side.vm.slidePx < 50) fail(`${vp} ${spec}: the slide is barely on screen (${side.vm.slidePx} px)`)
      // At rest and mid-inspect the gun and hands stay off the HUD clusters (aimed, the hands fall away under
      // the thumb buttons by design, so ADS only checks the ammo block and the vitals).
      // C5: the draw, the reloads and the hero draw are passing moments (under half a second over any one
      // cluster): only the poses she holds are kept off the HUD.
      const passing = /^pistol-(draw|hero|reload|presscheck)/.test(stage)
      for (const [q, share] of passing ? [] : side.vm.clear ?? []) {
        if (stage === 'pistol-ads' && q.startsWith('.tbtn')) continue
        if (share > 0.02) fail(`${vp} ${spec}: the viewmodel covers ${(share * 100).toFixed(1)}% of ${q}`)
      }
    }
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
    // ---- C9 acceptance ----
    if (/^(death-(gutclutch|wallslump|headshot|spin)|blood-pool)/.test(stage) && info) {
      const want = stage.startsWith('blood-pool') ? 'gutclutch' : stage.split('-')[1]
      console.log(`  C9 ${vp} ${spec}: variant ${info.variant}, asleep ${info.asleep}, pool ${info.pool ? `${info.pool.rx.toFixed(0)}x${info.pool.ry.toFixed(0)} px, ${info.pool.age.toFixed(1)} s` : 'none'}`)
      if (info.variant !== want) fail(`${vp} ${spec}: died as ${info.variant}, not ${want}`)
      const c = info.corpse.chest
      if (!(c.x > 0 && c.x < V.viewport.width && c.y > 0 && c.y < V.viewport.height)) fail(`${vp} ${spec}: the body is off screen`)
      if (stage.startsWith('blood-pool')) {
        if (V.intensity === 'reduced') {
          if (info.pool) fail(`${vp} ${spec}: a pool under reduced violence`)
        } else if (!info.pool) fail(`${vp} ${spec}: no pool`)
        else {
          const pr = await page.evaluate(([x, y, rx, ry]) => window.cathode.probePool(x, y, rx, ry), [info.pool.x, info.pool.y, info.pool.rx, info.pool.ry])
          console.log(`  C9 ${vp} ${spec}: pool ${(pr.red * 100).toFixed(0)}% blood red, ${(pr.bright * 100).toFixed(1)}% highlight, max luminance ${pr.maxLum.toFixed(2)}`)
          if (pr.red < 0.12) fail(`${vp} ${spec}: the pool is only ${(pr.red * 100).toFixed(0)}% red (< 12%)`)
          if (pr.maxLum < 0.3 || pr.bright < 0.002) fail(`${vp} ${spec}: no neon reflection in the pool (max luminance ${pr.maxLum.toFixed(2)}, ${(pr.bright * 100).toFixed(2)}% bright)`)
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
    const c7 = /^vitals-(hurt|critical|bleeding|regen)$/.test(stage)
    const c6 = /^(player-hurt|vitals-|grenade-near)/.test(stage) && !c7
    if (!c6 && !c7 && side.arcA > 0.05) fail(`${vp} ${spec}: a stale hurt arc shows (--a ${side.arcA})`)
    // ---- C6 acceptance ----
    if (c6) {
      const dm = side.dmg
      console.log(`  arc ${dm ? `a ${dm.a.toFixed(2)} rot ${dm.rotDeg.toFixed(0)} thick ${dm.thickPx.toFixed(1)} phys px ring ${(dm.radiusFrac * 100).toFixed(1)}% of height, this arc ${(dm.outFrac * 100).toFixed(1)}% out` : 'none'}; chevrons ${side.chevs.map((c) => (c.bottom ? 'bottom' : 'top')).join(',') || '-'}; nade ${side.nade.toFixed(2)}; guard ${side.vitals?.broken ? 'broken' : 'whole'}`)
      if (stage !== 'grenade-near' && !(dm && dm.a > 0.4)) fail(`${vp} ${spec}: no damage arc showing`)
      if (stage === 'player-hurt-100' && dm && Math.abs(dm.rotDeg - 90) > 10) fail(`${vp} ${spec}: the arc points at ${dm.rotDeg} deg, not 90`)
      if (vp === '5k' && stage === 'player-hurt-100' && t <= 200 && dm) {
        if (dm.thickPx < 36) fail(`${vp} ${spec}: the arc is ${dm.thickPx.toFixed(1)} physical px thick (< 36)`)
        if (Math.abs(dm.radiusFrac - 0.18) > 0.02) fail(`${vp} ${spec}: the arc's radius is ${(dm.radiusFrac * 100).toFixed(1)}% of the height (not 18 +- 2%)`)
      }
      // The side arc never sits on the gun's optic (C6 review: it read as part of the red-dot sight).
      if (stage === 'player-hurt-100' && dm?.box && side.optic) {
        const o = side.optic
        const m = 4
        const ov = Math.max(0, Math.min(dm.box.x + dm.box.w, o.x + o.w + m) - Math.max(dm.box.x, o.x - m)) * Math.max(0, Math.min(dm.box.y + dm.box.h, o.y + o.h + m) - Math.max(dm.box.y, o.y - m))
        console.log(`  optic ${o.x.toFixed(0)},${o.y.toFixed(0)} ${o.w.toFixed(0)}x${o.h.toFixed(0)}; arc box ${dm.box.x.toFixed(0)},${dm.box.y.toFixed(0)} ${dm.box.w.toFixed(0)}x${dm.box.h.toFixed(0)}`)
        if (ov > 0) fail(`${vp} ${spec}: the 90-degree arc overlaps the gun's optic (${ov.toFixed(0)} px2)`)
      }
      if (stage === 'player-hurt-behind' && !side.chevs.some((c) => c.bottom)) fail(`${vp} ${spec}: no bottom chevron for a hit from behind`)
      if (stage === 'player-hurt-100' && side.chevs.length) fail(`${vp} ${spec}: a chevron shows for a hit in front of her`)
      if (stage === 'vitals-guardbreak' && !(side.vitals?.broken && side.vitals?.shards)) fail(`${vp} ${spec}: Guard isn't shown breaking`)
      if (stage === 'grenade-near' && side.nade < 0.5) fail(`${vp} ${spec}: no grenade glyph on the ring`)
    }
    // ---- C8 acceptance ----
    if ((stage.startsWith('death-') && !/^death-(gutclutch|wallslump|headshot|spin)/.test(stage)) || stage.startsWith('resync')) {
      const dc = await page.evaluate(() => {
        const d = devicePixelRatio
        const box = (q) => {
          const e = document.querySelector(q)
          if (!e) return null
          const b = e.getBoundingClientRect()
          const cs = getComputedStyle(e)
          return { x: b.x, y: b.y, w: b.width, h: b.height, ph: b.height * d, opacity: Number(cs.opacity), vis: cs.visibility }
        }
        return { dying: window.cathode.dying, line: box('.death-line'), card: box('.death-card'), killer: box('.death-killer'), bar: box('.death-bar-t'), black: box('.death-black'), resync: box('.death-resync'), text: document.querySelector('.death-line')?.textContent ?? '' }
      })
      ;(side.c8 ??= {}).dom = dc
      console.log(`  dying ${dc.dying ? `${Math.round(dc.dying.ms)} ms card ${dc.dying.card} killer ${dc.dying.killer}` : 'no'}; headline ${dc.line ? dc.line.ph.toFixed(0) : '-'} physical px "${dc.text}"`)
      if (stage.startsWith('death-') && !dc.dying) fail(`${vp} ${spec}: not dying`)
      if (stage === 'death-card') {
        if (!(dc.card && dc.card.vis === 'visible' && dc.card.opacity > 0.9)) fail(`${vp} ${spec}: the death card isn't up`)
        if (vp === '5k' && !(dc.line && dc.line.ph >= 220)) fail(`${vp} ${spec}: the card's headline is ${dc.line?.ph?.toFixed(0)} < 220 physical px tall`)
        // Left-aligned in the 16:9 safe frame: the headline starts in the left third and stays on screen.
        if (dc.line && (dc.line.x > V.viewport.width / 3 || dc.line.x + dc.line.w > V.viewport.width || dc.line.y + dc.line.h > V.viewport.height)) fail(`${vp} ${spec}: the headline isn't left-aligned on screen`)
      }
      if (stage === 'death-1200' && dc.dying && !dc.dying.killer) fail(`${vp} ${spec}: no killer framed`)
      if (vp === 'rv' && stage === 'death-2000') {
        const r = await page.evaluate(() => window.cathode.probeBloodRed())
        console.log(`  reduced violence: ${r.red} blood-red pixels of ${r.total}`)
        if (r.red > 0) fail(`${vp} ${spec}: ${r.red} blood-red pixels under reduced violence`)
      }
    }
    // ---- C7 acceptance ----
    if (c7) {
      const wp = await page.evaluate(() => window.cathode.probeWound())
      ;(side.c7 ??= {}).probe = wp
      c7Hist[stage] = wp.hist
      const kc = wp.now.centre / Math.max(1e-4, wp.fine.centre)
      const ke = wp.now.edge / Math.max(1e-4, wp.fine.edge)
      console.log(`  w ${wp.w.toFixed(2)} pulse ${wp.pulse.toFixed(2)} lens ${wp.lens} glove ${wp.glove.toFixed(2)}; saturation centre ${wp.fine.centre.toFixed(3)} -> ${wp.now.centre.toFixed(3)} (x${kc.toFixed(2)}), ring ${wp.fine.edge.toFixed(3)} -> ${wp.now.edge.toFixed(3)} (x${ke.toFixed(2)})`)
      if (stage === 'vitals-bleeding') {
        // The colour drains from the edges first: the ring keeps clearly less of its saturation than the centre.
        if (!(ke < kc * C7_SAT_EDGE)) fail(`${vp} ${spec}: edge saturation x${ke.toFixed(2)} isn't below ${C7_SAT_EDGE} of the centre's x${kc.toFixed(2)}`)
        if (wp.lens < 1) fail(`${vp} ${spec}: no blood on the lens`)
        // The median of 21 paired rounds of 8 frames each, with the interquartile spread of the per-round ratio
        // (session.ts). C7 review: 11 rounds of 3 frames swung -20%..+23% on phone, so a verdict on the median
        // alone wasn't trustworthy. Longer rounds tighten the spread; the median must sit under 15% and the 75th
        // percentile under 15% too (a warning only: SwiftShader shares the CPU with the page).
        const b = await page.evaluate(() => window.cathode.benchGrade(8, 21))
        const over = (b.on - b.off) / Math.max(1e-3, b.off)
        const sp = b.spread ? ` spread ${(b.spread[0] * 100).toFixed(1)}%..${(b.spread[1] * 100).toFixed(1)}% over ${b.rounds} rounds` : ''
        console.log(`  grade pass ${b.off.toFixed(2)} ms idle, ${b.on.toFixed(2)} ms bleeding (+${(over * 100).toFixed(1)}%)${sp}`)
        if (over > 0.15) fail(`${vp} ${spec}: the Vitals pass costs +${(over * 100).toFixed(1)}% of the grade pass (> 15%)`)
        else if (b.spread && b.spread[1] > 0.15) warn(`${vp} ${spec}: the Vitals pass's 75th percentile is +${(b.spread[1] * 100).toFixed(1)}% (> 15%)`)
      }
      if (stage === 'vitals-critical' && wp.lens < 1) fail(`${vp} ${spec}: a heavy hit put no blood on the lens`)
      if (stage === 'vitals-critical' && !side.wound?.critical) fail(`${vp} ${spec}: the HUD doesn't say Critical`)
      if (stage === 'vitals-bleeding' && !side.wound?.bleeding) fail(`${vp} ${spec}: the HUD doesn't say Bleeding out`)
    }
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
  // C7: the four wounded states must look distinct from each other (a pairwise histogram difference).
  const ks = Object.keys(c7Hist)
  for (let i = 0; i < ks.length; i++)
    for (let j = i + 1; j < ks.length; j++) {
      const a = c7Hist[ks[i]]
      const b = c7Hist[ks[j]]
      const d = a.reduce((acc, v, k) => acc + Math.abs(v - b[k]), 0) / 2
      console.log(`  ${vp} histogram ${ks[i]} vs ${ks[j]}: ${d.toFixed(3)}`)
      if (d < C7_HIST_MIN) fail(`${vp}: ${ks[i]} and ${ks[j]} look too alike (histogram difference ${d.toFixed(3)} < ${C7_HIST_MIN})`)
    }
  for (const k of ks) delete c7Hist[k]
  await ctx.close()
}
await browser.close()
if (warnings.length) console.log(`\n${warnings.length} budget warning(s)`)
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
