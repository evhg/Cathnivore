// Plan item 743: Hedgerow 3D on the phone (390x844), level 27 in the sandbox, a round sent: where each depot's
// 'N to go' plate stands against the canvas and the viewport, and a shot. Needs a dist-site preview (BASE, default :4190).
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:4190'
const OUT = process.argv[2] ?? '.'
const level = Number(process.env.LEVEL ?? 27)
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
for (const [name, vp] of [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 })
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true }
  await page.goto(`${BASE}/hedgerow/?sandbox=1`)
  await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, seen: {}, tips: t })), [stars, tips, level])
  await page.goto(`${BASE}/hedgerow/?sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 120_000 })
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
  await page.evaluate(() => window.hedgerow.sendWave(window.hedgerow.game(), true))
  await page.waitForTimeout(8000)
  const m = await page.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect()
    const plates = [...document.querySelectorAll('.gate-plate')].filter((e) => !e.hidden).map((e) => {
      const r = e.getBoundingClientRect()
      return { text: e.textContent, leaving: 'leaving' in e.dataset, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })
    return { vw: innerWidth, canvas: { x: Math.round(c.x), w: Math.round(c.width) }, plates }
  })
  console.log(name, JSON.stringify(m))
  await page.screenshot({ path: `${OUT}/hedge-l${level}-3d-${name}.png`, timeout: 60_000 })
  await page.close()
}
await browser.close()
