// Plan item 47: the 2026-11-03 critique batch, each fix shot at the size that broke.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4190 &
//        BASE=http://localhost:4190 TAG=after node scripts/critique47-shots.mjs
// Prints a JSON report of the boxes the plan's acceptance names (clipping and overlap).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:4190'
const tag = process.env.TAG ?? 'after'
const out = process.env.OUT ?? 'e2e/screenshots/critique47'
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
mkdirSync(out, { recursive: true })
const P = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }
const D = { viewport: { width: 1440, height: 900 } }
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const report = {}
const shot = (p, name) => p.screenshot({ path: `${out}/${name}-${tag}.png` })

const jobs = {
  // Cathnivore campaign map: region names inside their own hex, none under Cath.
  async campaign() {
    for (const [n, o] of [['P', P], ['D', D]]) {
      const p = await browser.newPage(o)
      await p.goto(`${base}/cathnivore/`)
      await p.getByRole('button', { name: 'Campaign' }).click()
      await p.waitForTimeout(800)
      await p.locator('.cmp-map').scrollIntoViewIfNeeded()
      await shot(p, `${n}-campaign`)
      report[`campaign-${n}`] = await p.evaluate(() => {
        const names = [...document.querySelectorAll('.cmp-map-name')].map((e) => e.getBoundingClientRect())
        let hits = 0
        for (let i = 0; i < names.length; i++)
          for (let j = i + 1; j < names.length; j++) {
            const a = names[i], b = names[j]
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hits++
          }
        return { names: names.length, overlaps: hits }
      })
      await p.close()
    }
  },
  // Hedgerow title: the week chip names Hedgerow's own goal.
  async hedgerowTitle() {
    for (const [n, o] of [['P', P], ['D', D]]) {
      const p = await browser.newPage(o)
      await p.goto(`${base}/hedgerow/?2d`)
      await p.waitForTimeout(1500)
      await shot(p, `${n}-hedgerow-title`)
      report[`week-${n}`] = await p.evaluate(() => document.querySelector('#week-slot')?.textContent?.trim() ?? null)
      await p.close()
    }
  },
  // Hedgerow in play at P: the grip and the bar agree on the round.
  async hedgerowPlay() {
    const p = await browser.newPage(P)
    await p.goto(`${base}/hedgerow/?2d&sandbox=1&level=3`)
    await p.waitForTimeout(1500)
    for (let i = 0; i < 3; i++) {
      const d = p.locator('dialog[open] button').first()
      if (!(await d.count())) break
      await d.click().catch(() => {})
      await p.waitForTimeout(300)
    }
    for (let i = 0; i < 3; i++) await p.evaluate(() => { const hg = window.hedgerow; hg.sendWave(hg.game(), true); hg.refresh() })
    await p.waitForTimeout(800)
    await shot(p, 'P-hedgerow-play')
    report['hedgerow-play-P'] = await p.evaluate(() => ({
      grip: document.querySelector('.drawer-handle, [aria-expanded]')?.textContent?.trim() ?? null,
      wave: window.hedgerow?.game()?.wave ?? null,
    }))
    await p.close()
  },
  // NIGHT SHIFT title at D: the letterbox bars.
  async nightshift() {
    const ctx = await browser.newContext(D)
    await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full' })))
    const p = await ctx.newPage()
    await p.goto(`${base}/nightshift/?front=title&shot&t=8`, { timeout: 180000 })
    await p.waitForTimeout(12000)
    await shot(p, 'D-nightshift-title')
    report['nightshift-bars-D'] = await p.evaluate(() =>
      [...document.querySelectorAll('[class*="letterbox"], [class*="bar-top"], [class*="bars"]')].map((e) => Math.round(e.getBoundingClientRect().height)),
    )
    await ctx.close()
  },
}
for (const [k, f] of Object.entries(jobs)) {
  if (only && !only.includes(k)) continue
  try { await f() } catch (e) { report[k] = `error: ${String(e).slice(0, 200)}` }
}
console.log(JSON.stringify(report, null, 1))
await browser.close()
