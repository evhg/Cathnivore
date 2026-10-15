// Phase C screenshot runner (docs/design/cathode-combat.md S0): shoots CATHODE's combat stages at the three
// sizes every milestone is judged at, writes a JSON sidecar of DOM sizes (x DPR) and render stats next to each
// image, and fails when a milestone's size, presence or overlap check fails.
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-feel-shots.mjs [stage ...]
//
// Env: CATHODE_URL (default http://localhost:4180/cathode/), OUT (default e2e/screenshots), VPS=5k,d,phone.
// Kill any stale :4173/:4180 preview first (CLAUDE.md): a reused server can serve old assets.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/cathode/'
const out = process.env.OUT ?? 'e2e/screenshots'
mkdirSync(out, { recursive: true })
const C1 = ['hit-body', 'hit-head', 'hit-kill', 'hit-soft', 'blocked', 'cover-debug-market']
const stages = process.argv.slice(2).length ? process.argv.slice(2) : C1
const VIEWPORTS = {
  '5k': { viewport: { width: 2560, height: 1440 }, dsf: 2, q: '&rs=0.5' },
  d: { viewport: { width: 1440, height: 900 }, dsf: 1, q: '' },
  phone: { viewport: { width: 844, height: 390 }, dsf: 3, q: '&rs=0.5&quality=phone', touch: true },
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
  const ctx = await browser.newContext({ viewport: V.viewport, deviceScaleFactor: V.dsf, hasTouch: !!V.touch, isMobile: !!V.touch })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  await page.goto(`${base}?play&shot${V.q}`)
  await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) > 2 && typeof window.cathode?.stage === 'function', null, { timeout: 240_000 })
  await page.waitForTimeout(3000)
  for (const stage of stages) {
    const t = stage === 'hit-kill' ? 230 : 40
    const f0 = await page.evaluate(() => window.cathode.stats.frames)
    const cls = await page.evaluate(([s, tt]) => window.cathode.stage(s, tt), [stage, t])
    // SwiftShader draws about one frame a second: let two frames land so the HUD shows the stage.
    await page.waitForFunction((f) => window.cathode.stats.frames >= f + 3, f0, { timeout: 120_000 })
    await page.waitForTimeout(300)
    const file = `${out}/c-${stage}-${vp}`
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
      const clusters = ['.hud-objective', '.hud-vitals', '.hud-arms', '.hud-feed', '.hud-sub', '.hud-target', '.hud-prompt']
        .map((q) => [q, r(document.querySelector(q))])
        .filter(([, b]) => b && b.w > 0 && b.h > 0 && b.opacity > 0.05 && b.display !== 'none' && b.visibility !== 'hidden')
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
        stats: { frames: window.cathode.stats.frames, ms: window.cathode.stats.ms, drawCalls: info.render.calls, tris: info.render.triangles },
      }
    })
    side.stage = stage
    side.viewport = vp
    side.classShown = cls
    writeFileSync(`${file}.json`, JSON.stringify(side, null, 1))
    console.log(vp, stage, cls, 'tick', side.tick && `${Math.round(side.tick.ow)}x${Math.round(side.tick.oh)}`, 'ring', side.ring && Math.round(side.ring.ow), 'calls', side.stats.drawCalls)
    // ---- C1 acceptance ----
    if (stage.startsWith('hit-') && vp === '5k') {
      if (!(side.tick && side.tick.ow >= 6 && side.tick.oh >= 26)) fail(`${vp} ${stage}: tick ${side.tick?.ow}x${side.tick?.oh} < 6x26 physical`)
      if (side.hit.opacity < 0.5) fail(`${vp} ${stage}: marker not showing`)
    }
    if (stage === 'hit-kill') {
      if (vp === '5k' && !(side.ring && side.ring.ow >= 100)) fail(`${vp} hit-kill: kill ring ${side.ring?.ow} < 100 physical px`)
      if (!side.targetHidden) fail(`${vp} hit-kill: target bar still showing`)
    }
    if (stage === 'blocked') {
      if (side.hit.opacity > 0.01) fail(`${vp} blocked: a hit marker showed`)
      if (!(side.blocked.opacity > 0.5 && side.bracket.ow > 0)) fail(`${vp} blocked: no bracket glyph`)
    }
    if (vp === 'phone') {
      const cl = side.clusters
      for (let i = 0; i < cl.length; i++)
        for (let j = i + 1; j < cl.length; j++) {
          const [qa, a] = cl[i]
          const [qb, b] = cl[j]
          const ov = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
          if (ov > 4 * side.dpr * side.dpr) fail(`${vp} ${stage}: ${qa} overlaps ${qb} (${Math.round(ov)} px²)`)
        }
    }
  }
  await ctx.close()
}
await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
