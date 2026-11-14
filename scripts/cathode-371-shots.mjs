// Plan item 371: the title's List with Pell or the Chair as the open case (and the withheld prints), at P and D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4186 &  then  node scripts/cathode-371-shots.mjs <tag>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after'
const base = process.env.SITE_URL ?? 'http://localhost:4186'
const out = `e2e/screenshots/ns371`
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const sizes = { D: { width: 1440, height: 900 }, P: { width: 390, height: 844 } }
const saves = { pell: ['crispBoss', 'vaneBoss'], chair: ['crispBoss', 'vaneBoss', 'pellBoss'] }
for (const [who, jobs] of Object.entries(saves)) {
  for (const [n, vp] of Object.entries(sizes)) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: n !== 'D' })
    await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    const p = await ctx.newPage()
    await p.goto(`${base}/nightshift/?play&class=ghost&rs=0.5`, { timeout: 180000 })
    await p.waitForFunction(() => (window.cathode?.stats.frames ?? 0) >= 3, null, { timeout: 240000 })
    await p.evaluate((jobs) => { window.cathode.progress.jobsDone.push(...jobs); window.cathode.progress.save() }, jobs)
    await p.goto(`${base}/nightshift/?front=title&shot&t=8&quality=phone`, { timeout: 180000 })
    await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
    await p.reload() // past the strike-off animation
    await p.waitForFunction(() => window.cathodeFront?.ready, null, { timeout: 240000 })
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${tag}-${who}-${n}.png`, timeout: 240000 })
    const wall = p.locator('#the-list-wall')
    if (await wall.isVisible()) await wall.screenshot({ path: `${out}/${tag}-${who}-${n}-wall.png`, timeout: 240000 })
    await ctx.close()
  }
}
await b.close()
