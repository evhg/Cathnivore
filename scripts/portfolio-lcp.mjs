// Plan item 339: the portfolio's Largest Contentful Paint on a throttled run (Lighthouse's mobile profile: 150 ms RTT,
// 1.6 Mbps down, 4x CPU), at P and D. Not a gate spec (timings swing on a loaded CI runner); run it against a
// `dist-site` preview: `npx vite preview --outDir dist-site --port 4180` then `node scripts/portfolio-lcp.mjs`
// (BASE overrides the URL; PLAYWRIGHT_CHROMIUM_PATH picks the browser). The target is 2 s or under.
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'http://localhost:4180/'
const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
let worst = 0
for (const [n, vp, mobile] of [['P', { width: 390, height: 844 }, true], ['D', { width: 1440, height: 900 }, false]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await p.addInitScript(() => { window.__lcp = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push([Math.round(e.startTime), e.element?.tagName + '.' + (e.element?.className?.baseVal ?? e.element?.className ?? ''), e.url?.split('/').pop(), e.size]) }).observe({ type: 'largest-contentful-paint', buffered: true }) })
  await p.goto(base, { waitUntil: 'load', timeout: 120000 })
  await p.waitForTimeout(4000)
  const lcp = await p.evaluate(() => window.__lcp)
  const last = lcp.at(-1)?.[0] ?? Infinity
  worst = Math.max(worst, last)
  console.log(n, 'LCP', last, 'ms', JSON.stringify(lcp.at(-1)))
  await ctx.close()
}
await b.close()
console.log(worst <= 2000 ? 'ok: 2 s or under' : 'over 2 s')
process.exitCode = worst <= 2000 ? 0 : 1
