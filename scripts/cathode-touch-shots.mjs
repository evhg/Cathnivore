// Plan item 40: NIGHT SHIFT's touch controls on a phone held sideways (844x390, touch), at rest and scoped,
// with each control's box checked against the look hint and the scope's circle.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-touch-shots.mjs [tag]
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
for (const [n, vp] of [['L', { width: 844, height: 390 }], ['L2', { width: 932, height: 430 }]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  const p = await ctx.newPage()
  await p.goto((process.env.BASE ?? 'http://localhost:4186') + '/nightshift/?play&class=ghost&district=plaza&rs=0.75&quality=phone')
  await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) > 5, null, { timeout: 240000 })
  // Past the tutorial: every control the game introduces, and the Widowmaker in her hands for the scope.
  await p.evaluate(() => {
    const c = window.cathode
    c.progress.unlocks.features.push('crouch', 'takedown', 'focus', 'skills', 'swap')
    c.arsenal.owned.add('widowmaker')
    c.arsenal.equipId('widowmaker')
  })
  await p.waitForTimeout(6000)
  const measure = () => p.evaluate(() => {
    const box = (q) => { const r = document.querySelector(q)?.getBoundingClientRect(); return r && r.width ? { l: r.left, r: r.right, t: r.top, b: r.bottom } : null }
    const hit = (a, c) => a && c && !(a.r <= c.l || a.l >= c.r || a.b <= c.t || a.t >= c.b)
    const hint = box('.look-hint')
    const btns = [...document.querySelectorAll('[data-btn], .tbtn-menu')].map((e) => { const r = e.getBoundingClientRect(); return r.width ? { n: e.dataset.btn ?? 'menu', l: r.left, r: r.right, t: r.top, b: r.bottom } : null }).filter(Boolean)
    const R = Math.min(innerWidth, innerHeight) * 0.4, cx = innerWidth / 2, cy = innerHeight / 2
    const inCircle = (a) => { const x = Math.max(a.l, Math.min(cx, a.r)), y = Math.max(a.t, Math.min(cy, a.b)); return Math.hypot(x - cx, y - cy) < R + 4 }
    const overlaps = []
    for (let i = 0; i < btns.length; i++) {
      if (hit(btns[i], hint)) overlaps.push(btns[i].n + '/hint')
      for (let j = i + 1; j < btns.length; j++) if (hit(btns[i], btns[j])) overlaps.push(btns[i].n + '/' + btns[j].n)
    }
    return { hint, shown: btns.map((x) => x.n).join(','), weapon: document.querySelector('.hud-weapon')?.textContent, overlaps, inScope: btns.filter(inCircle).map((x) => x.n), scoped: document.documentElement.classList.contains('hud-aiming') }
  })
  console.log(n, 'rest', JSON.stringify(await measure()))
  await p.screenshot({ path: `e2e/screenshots/touch-${tag}-${n}-rest.png`, timeout: 240000 })
  // Plan item 44: after first use, Fire, Aim, Swap and Cath rest as rings with no word.
  await p.evaluate(() => document.querySelectorAll('[data-btn="fire"], [data-btn="aim"], [data-btn="cycle"], [data-btn="sheet"]').forEach((e) => e.classList.add('used')))
  await p.waitForTimeout(3000)
  console.log(n, 'ring label opacity', await p.evaluate(() => getComputedStyle(document.querySelector('[data-btn="aim"] .tbtn-label')).opacity))
  await p.screenshot({ path: `e2e/screenshots/touch-${tag}-${n}-rings.png`, timeout: 240000 })
  // Plan item 44: the whole cluster up at once (every moment's button forced on), checked for overlaps.
  await p.evaluate(() => { window.__idle = [...document.querySelectorAll('.tbtn.idle')]; window.__idle.forEach((e) => e.classList.remove('idle')); window.cathode.input.context = () => {} })
  await p.waitForTimeout(800)
  console.log(n, 'all', JSON.stringify(await measure()))
  await p.screenshot({ path: `e2e/screenshots/touch-${tag}-${n}-all.png`, timeout: 240000 })
  await p.evaluate(() => window.cathode.input.touchHeld.add('aim'))
  await p.waitForTimeout(4000)
  console.log(n, 'aim', JSON.stringify(await measure()))
  await p.screenshot({ path: `e2e/screenshots/touch-${tag}-${n}-scope.png`, timeout: 240000 })
  // Plan item 44: the mag run low, so the round count shows its "Tap to reload".
  await p.evaluate(() => window.cathode.input.touchHeld.delete('aim'))
  await p.waitForFunction(() => {
    if (document.querySelector('.hud-ammo.low, .hud-ammo.empty')) return true
    window.cathode.input.forced = { fire: true }
    return false
  }, null, { timeout: 200000, polling: 400 }).catch(() => console.log(n, 'mag never ran low'))
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `e2e/screenshots/touch-${tag}-${n}-low.png`, timeout: 240000 })
  await ctx.close()
}
await b.close()
