// Plan item 26: Cath's hands in first person, per weapon class at rest and mid-inspect, and in each outfit,
// at 1440x900 (D) and a landscape phone (L, 844x390).
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-hands-shots.mjs [stage ...]
//
// Env: CATHODE_URL (default http://localhost:4186/cathode/), OUT (default e2e/screenshots/hands), VPS=d,l.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4186/cathode/'
const out = process.env.OUT ?? 'e2e/screenshots/hands'
mkdirSync(out, { recursive: true })
const VP = {
  d: { viewport: { width: 1440, height: 900 }, dsf: 1, q: '' },
  l: { viewport: { width: 844, height: 390 }, dsf: 2, q: '&rs=0.75&quality=phone', touch: true },
}
// [stage, ms, dress]: the dress is `<coat>.<gloves>` (base ids or "none").
const DEFAULT = [
  ['pistol-idle', 0, ''],
  ['pistol-inspect', 900, ''],
  ...['revolver', 'smg', 'rifle', 'shotgun', 'sniper', 'launcher'].flatMap((m) => [[`${m}-idle`, 0, ''], [`${m}-inspect`, 1000, '']]),
  ['pistol-idle', 0, 'duster.none'],
  ['pistol-idle', 0, 'armouredMac.knuckleGloves'],
  ['pistol-idle', 0, 'silkLinedCoat.wiredGloves'],
  ['pistol-inspect', 900, 'none.none'],
]
const args = process.argv.slice(2)
const list = args.length ? DEFAULT.filter(([s, , d]) => args.some((a) => `${s}${d ? `+${d}` : ''}`.includes(a))) : DEFAULT
const vps = (process.env.VPS ?? 'd,l').split(',')
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
for (const vp of vps) {
  const V = VP[vp]
  const ctx = await browser.newContext({ viewport: V.viewport, deviceScaleFactor: V.dsf, hasTouch: !!V.touch, isMobile: !!V.touch })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
  let page = await ctx.newPage()
  let loaded = null
  for (const [stage, ms, dress] of list) {
    const q = `${V.q}${dress ? `&dress=${dress}` : ''}`
    if (q !== loaded) {
      if (loaded !== null) {
        await page.close({ runBeforeUnload: false })
        page = await ctx.newPage()
      }
      loaded = q
      await page.goto(`${base}?play&shot${q}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
      await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) > 2 && typeof window.cathode?.stage === 'function', null, { timeout: 400_000 })
      await page.waitForTimeout(2000)
    }
    const f0 = await page.evaluate(() => window.cathode.stats.frames)
    await page.evaluate(([s, t]) => window.cathode.stage(s, t), [stage, ms])
    await page.waitForFunction((f) => window.cathode.stats.frames >= f + 3, f0, { timeout: 600_000 })
    await page.waitForTimeout(300)
    const file = `${out}/hands-${stage}${dress ? `-${dress.replace('.', '-')}` : ''}-${vp}.png`
    await page.screenshot({ path: file, timeout: 300_000 })
    console.log(file)
  }
  await ctx.close()
}
await browser.close()
