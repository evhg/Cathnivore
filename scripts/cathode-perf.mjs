// CATHODE performance gate (docs/design/cathode-combat.md S0 "Measuring"): stages a firefight and asserts the
// whole scene's draw calls and triangles against the budget table. Draw calls and triangles are deterministic
// under SwiftShader; time isn't, so combatMs is only reported here.
//
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-perf.mjs
//
// PERF_ONLY=phone|desktop runs one case. Serves dist-site itself on :4181 (run `npm run build:site` first) unless CATHODE_URL is set. Joins
// `npm run gates` as a CATHODE sub-check from C10.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'

const CASES = [
  // The phone: 6 full-detail enemies firing, the whole scene in 260 calls (S0).
  { name: 'phone firefight-6', stage: 'firefight-6', viewport: { width: 844, height: 390 }, dsf: 3, q: '&rs=0.5&quality=phone', touch: true, calls: 260, tris: 260_000 },
  // Desktop: 12 enemies, the gate's 900 calls. The triangle caps sit about a third over the 2026-10-19 measure (192k phone,
  // 483k desktop): the spec budgets triangles per enemy LOD (cathode-models), so these catch a scene-wide regression.
  { name: 'desktop firefight-12', stage: 'firefight-12', viewport: { width: 1440, height: 900 }, dsf: 1, q: '', calls: 900, tris: 650_000 },
]

let server = null
let base = process.env.CATHODE_URL
if (!base) {
  base = 'http://localhost:4181/cathode/'
  server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-site', '--port', '4181', '--strictPort'], { stdio: 'ignore', detached: true })
  const t0 = Date.now()
  for (;;) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      // not up yet
    }
    if (Date.now() - t0 > 60_000) throw new Error('preview server did not start on :4181')
    await new Promise((r) => setTimeout(r, 300))
  }
}
const stop = () => {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      // gone
    }
  }
}

const failures = []
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
try {
  for (const C of CASES.filter((c) => !process.env.PERF_ONLY || c.name.startsWith(process.env.PERF_ONLY))) {
    const ctx = await browser.newContext({ viewport: C.viewport, deviceScaleFactor: C.dsf, hasTouch: !!C.touch, isMobile: !!C.touch })
    await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
    const page = await ctx.newPage()
    await page.goto(`${base}?play&shot${C.q}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
    await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) > 2 && typeof window.cathode?.stage === 'function', null, { timeout: 400_000 })
    const res = await page.evaluate((s) => window.cathode.stage(s, 40), C.stage)
    if (res !== 'ok') {
      failures.push(`${C.name}: stage said ${res}`)
      await ctx.close()
      continue
    }
    // Three frames on the stage; take the largest count (a shadow-refresh frame draws more).
    let calls = 0
    let tris = 0
    let refl = 0
    for (let k = 0; k < 3; k++) {
      const f0 = await page.evaluate(() => window.cathode.stats.frames)
      await page.waitForFunction((f) => window.cathode.stats.frames > f, f0, { timeout: 120_000 })
      const p = await page.evaluate(() => window.cathode.world.perf)
      calls = Math.max(calls, p.drawCalls)
      tris = Math.max(tris, p.triangles)
      refl = Math.max(refl, p.reflCalls ?? 0)
    }
    const ms = await page.evaluate(() => window.cathode.stats.combatMs ?? null)
    const ok = calls <= C.calls && tris <= C.tris
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${C.name}: ${calls} draw calls (budget ${C.calls}, mirror ${refl}), ${tris} triangles (budget ${C.tris}), combatMs ${ms?.toFixed(2)} (SwiftShader, not judged)`)
    if (calls > C.calls) failures.push(`${C.name}: ${calls} draw calls > ${C.calls}`)
    if (tris > C.tris) failures.push(`${C.name}: ${tris} triangles > ${C.tris}`)
    await ctx.close()
  }
} finally {
  await browser.close()
  stop()
}
if (failures.length) {
  console.log(`\nCATHODE perf: ${failures.length} over budget\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nCATHODE perf: within budget')
