// Plan item 629: the case loader (staged, held) at P, D and L. OUT=<dir> TAG=<prefix>
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &   then node scripts/cathode-629-shots.mjs
import { chromium } from '@playwright/test'
const base = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots'
const tag = process.env.TAG ?? 'l629'
const stages = (process.env.STAGES ?? 'loading,loading-travel,loading-office').split(',')
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [vp, w, h] of [['P', 390, 844], ['D', 1440, 900], ['L', 844, 390]].filter(([v]) => (process.env.VPS ?? 'P,D,L').split(',').includes(v))) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  const p = await ctx.newPage()
  for (const st of stages) {
    await p.goto(`${base}?front=${st}&shot`)
    await p.locator('#loading:not([hidden]) .ld-name').waitFor({ timeout: 120_000 })
    await p.waitForTimeout(2500)
    const boxes = await p.evaluate(() => Object.fromEntries(['.ld-name', '.ld-lore', '.ld-corner', '.ld-cath', '.ld-still', '.ld-map', '.ld-print', '.ld-string'].map((s) => {
      const e = document.querySelector('#loading ' + s)
      if (!e) return [s, null]
      const r = e.getBoundingClientRect()
      return [s, [r.left, r.top, r.right, r.bottom].map(Math.round).join(',')]
    })))
    console.log(vp, st, JSON.stringify(boxes))
    await p.screenshot({ path: `${out}/${tag}-${st}-${vp}.png` })
  }
  await ctx.close()
}
await b.close()
