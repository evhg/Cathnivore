// Plan item 749: a contact sheet of every Hedgerow vehicle's 2D sprite, side view and as a Fleet level draws it, in colour and greyscale.
// Usage: npx vite preview --outDir dist-site --port 4181 &  node scripts/hedgerow-749-sheet.mjs <outdir>
import { chromium } from '@playwright/test'
const S = process.argv[2] ?? 'e2e/screenshots/h749'
import { mkdirSync } from 'node:fs'
mkdirSync(S, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
await p.goto(`${process.env.BASE ?? 'http://localhost:4181'}/hedgerow/?sandbox=1&2d&level=34`)
await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
const kinds = ['courier','hatchback','van','pickup','sprinter','lorry','steel','artic','transporter','skip','crane','plantdozer','drone','quad','execcar']
const urls = await p.evaluate(([ks, CELL]) => ks.map((k) => [k, window.hedgerow.enemySprite(k, CELL, false), window.hedgerow.enemySprite(k, CELL, true)]), [kinds, Number(process.env.CELL ?? 64)])
await p.setContent(`<body style="margin:0;background:#9bb27a;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px">${urls.map(([k,a,c])=>`<div style="background:#8a8a80"><div>${k}</div><img src="${a}"><img src="${c}"></div>`).join('')}</div></body>`)
await p.screenshot({ path: `${S}/sheet.png`, fullPage: true })
await p.addStyleTag({ content: 'img{filter:grayscale(1)}' })
await p.screenshot({ path: `${S}/sheet-grey.png`, fullPage: true })
await b.close()

// The field: l34 with one of each big rig and flier spawned along the lane, at P (2x) and D, for BASE (default the
// same preview) — run against the old build too for a before shot.
const base = process.env.BASE ?? 'http://localhost:4181'
const tag = process.env.TAG ?? 'field'
const SIZES = { P: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, D: { viewport: { width: 1440, height: 900 } } }
const b2 = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const [sz, o] of Object.entries(SIZES)) {
  const ctx = await b2.newContext(o)
  const q = await ctx.newPage()
  await q.goto(`${base}/hedgerow/?sandbox=1&2d`)
  await q.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3])), seenBefore: { 34: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, bridge: true } })))
  await q.goto(`${base}/hedgerow/?sandbox=1&2d&level=34`)
  await q.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await q.addStyleTag({ content: '#intro { display: none !important; }' })
  await q.evaluate(() => {
    const h = window.hedgerow
    const ks = ['steel', 'artic', 'transporter', 'skip', 'drone', 'quad', 'plantdozer', 'crane', 'execcar', 'steel']
    ks.forEach((k, i) => h.spawn(k, 1.5 + i * 1.6))
  })
  await q.waitForTimeout(1500)
  await q.screenshot({ path: `${S}/${tag}-${sz}.png` })
  await ctx.close()
}
await b2.close()
