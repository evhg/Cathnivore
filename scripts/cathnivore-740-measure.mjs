// Plan item 740, measure first: an autoplayed Quick Game stopped at rounds 2, 5 and 8 (as e2e board-pieces), at D and
// P. Per hex: the region landmark's box, each producer stall's box and each Outlet stack's box (CSS px, from
// getBoundingClientRect). Reports the median and the smallest landmark height, the stalls' median area over the
// Outlets' median area, and the Outlets' median and largest height.
// Usage: a Cathnivore preview on :4173 (npm run build && npx vite preview), then node scripts/cathnivore-740-measure.mjs
import { chromium } from 'playwright'
const base = process.env.URL ?? 'http://localhost:4173'
const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null }
for (const [name, vp] of [['D', { width: 1440, height: 900 }], ['P', { width: 390, height: 844 }]]) {
  const all = { lm: [], stall: [], outlet: [], outletArea: [], stallArea: [] }
  for (const until of [2, 5, 8]) {
    const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { hasTouch: true, isMobile: true } : {}) })
    const page = await ctx.newPage()
    // SEED=n: a seeded Math.random, so old and new code are measured on the same deals.
    if (process.env.SEED) await page.addInitScript((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }, Number(process.env.SEED))
    await page.goto(`${base}/?e2eAutoplay=1&e2eAutoplayUntil=${until}`)
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForFunction((u) => !!document.querySelector('.end-screen') || Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0) >= u, until, { timeout: 90000 })
    await page.waitForTimeout(2500)
    if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/c740/${process.env.SHOTS}-${name}-r${until}.png` })
    const r = await page.evaluate(() => {
      const svg = document.querySelector('.map-wrap svg.map[data-round]')
      const out = { lm: [], stall: [], outlet: [] }
      if (!svg) return out
      for (const el of svg.querySelectorAll('.board-landmark')) { const q = el.getBoundingClientRect(); out.lm.push([q.width, q.height, el.getAttribute('data-landmark'), el.getAttribute('data-target'), el.hasAttribute('data-full')]) }
      for (const el of svg.querySelectorAll('.region-hex [data-piece="stall"]')) { const q = el.getBoundingClientRect(); out.stall.push([q.width, q.height]) }
      for (const el of svg.querySelectorAll('.region-hex [data-piece="o"]')) { const q = el.getBoundingClientRect(); out.outlet.push([q.width, q.height, el.closest('.region-hex')?.getAttribute('data-region') ?? el.closest('[data-region]')?.getAttribute('data-region'), el.outerHTML.length]) }
      return out
    })
    if (process.env.DETAIL) for (const q of r.lm) if (q[1] < (vp.width > 600 ? 66 : 38)) console.log(name, until, q.map((v) => (typeof v === 'number' ? +v.toFixed(1) : v)).join(' '))
    if (process.env.DETAIL) for (const q of r.outlet) if (q[1] > (vp.width > 600 ? 48 : 30)) console.log(name, until, 'outlet', q.map((v) => (typeof v === 'number' ? +v.toFixed(1) : v)).join(' '))
    all.lm.push(...r.lm.map((q) => q[1])); all.stall.push(...r.stall.map((q) => q[1])); all.outlet.push(...r.outlet.map((q) => q[1]))
    all.stallArea.push(...r.stall.map((q) => q[0] * q[1])); all.outletArea.push(...r.outlet.map((q) => q[0] * q[1]))
    await ctx.close()
  }
  console.log(name, JSON.stringify({
    landmarks: all.lm.length, lmMedianH: med(all.lm), lmMinH: all.lm.length ? +Math.min(...all.lm).toFixed(1) : null,
    stalls: all.stall.length, stallMedianH: med(all.stall), outlets: all.outlet.length, outletMedianH: med(all.outlet),
    outletMaxH: all.outlet.length ? +Math.max(...all.outlet).toFixed(1) : null,
    stallOverOutletArea: all.outletArea.length ? +(med(all.stallArea) / med(all.outletArea)).toFixed(2) : null,
  }))
}
await b.close()
