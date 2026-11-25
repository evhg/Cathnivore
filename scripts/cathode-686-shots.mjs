// Plan item 686: the sideways phone's controls round the gun. For each phone size: a shot after her first input,
// each control's box, the viewmodel's pixels inside it (vmProbe inRects), and which hint lines still show 4.5 s on.
// CATHODE_URL=... node scripts/cathode-686-shots.mjs <tag>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'x', out = process.env.OUT ?? 'e2e/screenshots/ns686'
mkdirSync(out, { recursive: true })
const url = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const sizes = (process.env.SIZES ?? '844x390,932x430').split(',').map((s) => s.split('x').map(Number))
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [w, h] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await p.goto(`${url}?play&class=ghost&rs=0.5`)
  await p.waitForFunction(() => !!window.cathode?.job && window.cathode.stats.frames >= 2, null, { timeout: 300000 })
  await p.screenshot({ path: `${out}/${tag}-${w}-arrive.png` })
  await p.waitForFunction(() => { const c = window.cathode; c.input.forced = { reload: true }; return !c.arsenal.lowered }, null, { timeout: 90000, polling: 1000 })
  await p.waitForFunction(() => window.cathode.arsenal.anim.dip < 0.05, null, { timeout: 90000, polling: 500 })
  if (process.env.FULL) await p.evaluate(() => { const c = window.cathode; c.progress.unlocks.features.push('crouch', 'takedown', 'focus', 'skills', 'swap'); c.arsenal.owned.add('widowmaker'); c.arsenal.equipId('widowmaker') })
  if (process.env.FULL) await p.waitForTimeout(3000)
  await p.evaluate(() => document.querySelectorAll('.tbtn.idle').forEach((e) => e.classList.remove('idle')))
  await p.touchscreen.tap(120, h - 90)
  await p.waitForTimeout(4500)
  const m = await p.evaluate(() => {
    const c = window.cathode
    const sel = ['.tbtn-fire', '.tbtn-aim', '.tbtn-cycle', '.tbtn-takedown', '.tbtn-skill', '.tbtn-focus', '.tbtn-sheet', '.hud-weapon']
    const els = sel.map((s) => document.querySelector(s)).filter(Boolean)
    const rects = els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
    const pr = c.vmProbe(rects)
    const vis = (s) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { op: +cs.opacity, vis: cs.visibility, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: (e.textContent ?? '').slice(0, 40) } }
    return {
      vmPx: pr.vmPx,
      hits: els.map((e, i) => ({ s: e.className.split(' ').slice(0, 2).join('.'), r: rects[i] && Object.fromEntries(Object.entries(rects[i]).map(([k, v]) => [k, Math.round(v)])), vm: +pr.inRects[i].toFixed(3), idle: e.classList.contains('idle') })),
      look: vis('.look-hint'), teach: vis('.hud-teach'), tip: vis('.stick-tip'), weapon: vis('.hud-weapon'),
    }
  })
  console.log(w, h, JSON.stringify(m))
  await p.screenshot({ path: `${out}/${tag}-${w}.png` })
  await ctx.close()
}
await b.close()
