// C10: shoots the enemy review turntable (`/cathode/?shot&arch=...`, game/turntable.ts) at the three Phase C sizes.
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-turntable.mjs [query ...]
// Each query is the part after ?shot& (default: arch=enforcer, arch=all, arch=enforcer&view=close, arch=all&sil=1,
// arch=enforcer&lod=1, arch=enforcer&lod=2). Env: CATHODE_URL (default http://localhost:4180/cathode/), OUT, VPS.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/cathode/'
const out = process.env.OUT ?? 'e2e/screenshots'
mkdirSync(out, { recursive: true })
const queries = process.argv.slice(2).length ? process.argv.slice(2) : ['arch=enforcer', 'arch=all', 'arch=enforcer&view=close', 'arch=all&sil=1', 'arch=enforcer&lod=1', 'arch=enforcer&lod=2', 'arch=all&pose=aim']
const VIEWPORTS = {
  '5k': { viewport: { width: 2560, height: 1440 }, dsf: 2, q: '' },
  d: { viewport: { width: 1440, height: 900 }, dsf: 1, q: '' },
  phone: { viewport: { width: 844, height: 390 }, dsf: 3, q: '&phone=1' },
}
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const vp of (process.env.VPS ?? '5k,d,phone').split(',')) {
  const V = VIEWPORTS[vp]
  const ctx = await browser.newContext({ viewport: V.viewport, deviceScaleFactor: V.dsf })
  for (const q of queries) {
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${base}?shot&${q}${V.q}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
    await page.waitForFunction(() => window.cathodeTurntable?.ready, null, { timeout: 300_000 })
    await page.waitForTimeout(500)
    const name = `t-${q.replace(/[&=]/g, '-')}-${vp}.png`
    await page.screenshot({ path: `${out}/${name}`, timeout: 300_000 })
    console.log(vp, q, errors.length ? `ERRORS ${errors.join(' | ')}` : 'ok', name)
    await page.close()
  }
  await ctx.close()
}
await browser.close()
