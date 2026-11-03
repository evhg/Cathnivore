// The title's frame cost (owner feedback 2026-11-02: "the startup screen animation is very stuttery"): boots the
// title at 1440x900 on high quality, waits for it, then samples the front scene's own frame time (render + update,
// CPU side; under SwiftShader that includes the GPU work) and draw calls over N frames. Shoots the frame too.
//   node scripts/cathode-title-perf.mjs http://localhost:<port>/nightshift/ <tag>
import { chromium } from '@playwright/test'
const [base, tag = 'title'] = process.argv.slice(2)
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
const p = await ctx.newPage()
await p.goto(base)
await p.waitForFunction(() => (window.cathodeFront?.scene?.()?.stats?.frames ?? 0) > 5, null, { timeout: 300_000 })
await p.waitForTimeout(4000)
// Frames drawn in 20 s of wall time: under SwiftShader the GPU work is on the CPU, so fewer frames = a heavier title.
const r = await p.evaluate(async () => {
  const st = window.cathodeFront.scene().stats
  const f0 = st.frames
  await new Promise((res) => setTimeout(res, 20_000))
  return { frames20s: st.frames - f0, calls: st.drawCalls }
})
await p.screenshot({ path: `/tmp/claude-0/${tag}-title-D.png` })
console.log(tag, JSON.stringify(r))
await b.close()
