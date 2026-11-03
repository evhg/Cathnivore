// Plan item 57: the street's people, calm and mid-fight, in the market and the Plaza at D and L, and the phone tier at
// L. Counts the people on screen and their mean distance from Cath before and 3 s after one forced shot.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then
//   node scripts/cathode-street-shots.mjs [tag] [port]   (DISTRICTS=market,plaza  SIZES=D,L,Lphone)
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'after'
const port = process.argv[3] ?? '4186'
const districts = (process.env.DISTRICTS ?? 'market,plaza').split(',')
const sizes = (process.env.SIZES ?? 'D,L,Lphone').split(',')
const VP = { D: { width: 1440, height: 900 }, L: { width: 844, height: 390 }, Lphone: { width: 844, height: 390 } }
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const census = () => {
  const c = window.cathode
  const w = c.world
  const people = w.street?.snapshot() ?? []
  const cam = w.camera
  let onScreen = 0
  for (const s of people) {
    if (s.mood === 'gone') continue
    const v = cam.position.clone().set(s.x, s.y + 1.2, s.z).project(cam)
    if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) onScreen++
  }
  const near = people.filter((s) => Math.hypot(s.x - c.player.pos.x, s.z - c.player.pos.z) < 30)
  const mean = near.length ? near.reduce((n, s) => n + Math.hypot(s.x - c.player.pos.x, s.z - c.player.pos.z), 0) / near.length : 0
  const moods = {}
  for (const s of people) moods[s.mood] = (moods[s.mood] ?? 0) + 1
  return { people: people.length, onScreen, mean: Math.round(mean * 10) / 10, moods, calls: w.perf?.drawCalls }
}
for (const d of districts)
  for (const n of sizes) {
    const ctx = await b.newContext({ viewport: VP[n] })
    await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
    const p = await ctx.newPage()
    await p.goto(`http://localhost:${port}/nightshift/?play&class=gunslinger&district=${d}` + (n === 'Lphone' ? '&rs=0.75&quality=phone' : ''))
    await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) > 5, null, { timeout: 240000 })
    await p.waitForTimeout(6000)
    const calm = await p.evaluate(census)
    await p.screenshot({ path: `e2e/screenshots/street-${tag}-${d}-${n}-calm.png`, timeout: 240000 })
    // A shot from her gun's muzzle (she starts with the baton, so fire it as a gun would: every shot's flash is where
    // the street hears it).
    await p.evaluate(() => {
      const w = window.cathode.world
      const dir = w.camera.getWorldDirection(w.camera.position.clone())
      w.fx.muzzle(w.camera.position.clone().addScaledVector(dir, 0.6), dir, 0.7)
    })
    await p.waitForTimeout(3000)
    const fight = await p.evaluate(census)
    console.log(tag, d, n, 'calm', JSON.stringify(calm), 'fight', JSON.stringify(fight))
    await p.screenshot({ path: `e2e/screenshots/street-${tag}-${d}-${n}-fight.png`, timeout: 240000 })
    await ctx.close()
  }
await b.close()
