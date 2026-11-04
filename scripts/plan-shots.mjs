// Planning shots (CLAUDE.md step 4): every game's main screens at P (390x844) and D (1440x900), for a fresh-eyes
// critique against VISION.md. Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/plan1103f node scripts/plan-shots.mjs   (ONLY=hedgerow,runnel)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4180'
const out = process.env.OUT ?? 'e2e/screenshots/plan'
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
mkdirSync(out, { recursive: true })
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, D: { viewport: { width: 1440, height: 900 } } }
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
const jobs = {
  async site(p, s) {
    await p.goto(`${base}/`); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/portfolio-${s}.png` })
    await p.goto(`${base}/games/`); await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/games-${s}.png` })
  },
  async cathnivore(p, s) {
    await p.goto(`${base}/cathnivore/`); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/cath-title-${s}.png` })
    await p.getByText('Quick Game').click(); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/cath-setup-${s}.png` })
    await p.getByRole('button', { name: 'Start' }).click(); await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/cath-game-${s}.png` })
    try {
      await p.goto(`${base}/cathnivore/`); await p.waitForTimeout(1200)
      await p.getByText('Campaign', { exact: false }).first().click(); await p.waitForTimeout(1500)
      await p.screenshot({ path: `${out}/cath-campaign-${s}.png` })
    } catch (e) { console.log('campaign', s, String(e).split('\n')[0]) }
  },
  async runnel(p, s) {
    await p.goto(`${base}/runnel/`); await p.waitForTimeout(2000); await p.screenshot({ path: `${out}/runnel-${s}.png` })
  },
  async hedgerow(p, s) {
    await p.goto(`${base}/hedgerow/?2d`)
    await p.evaluate(([st, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 21: true }, tips: t })), [stars(20), tips])
    await p.goto(`${base}/hedgerow/`); await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/hedge-menu-${s}.png` })
    for (const mode of ['2d', '3d']) {
      await p.goto(`${base}/hedgerow/?sandbox=1&level=21${mode === '2d' ? '&2d' : ''}`)
      await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
      await p.waitForTimeout(mode === '2d' ? 1000 : 5000)
      await p.screenshot({ path: `${out}/hedge-l21-${mode}-${s}.png` })
    }
    await p.goto(`${base}/hedgerow/?sandbox=1&level=34&2d`)
    await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
    await p.waitForTimeout(1000); await p.screenshot({ path: `${out}/hedge-l34-2d-${s}.png` })
  },
  async nightshift(p, s) {
    await p.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await p.goto(`${base}/nightshift/`); await p.waitForTimeout(9000); await p.screenshot({ path: `${out}/ns-title-${s}.png` })
    await p.goto(`${base}/nightshift/?play`); await p.waitForTimeout(15000); await p.screenshot({ path: `${out}/ns-play-${s}.png` })
  },
}
for (const [name, job] of Object.entries(jobs)) {
  if (only && !only.includes(name)) continue
  for (const [s, o] of Object.entries(SIZES)) {
    const ctx = await browser.newContext(o)
    const p = await ctx.newPage()
    try { await job(p, s) } catch (e) { console.log(name, s, 'failed:', String(e).split('\n')[0]) }
    await ctx.close()
  }
  console.log(name, 'done')
}
await browser.close()
