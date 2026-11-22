// Plan item 628: the rack's packets measured (art, role word, name, price; clipped text; unexplained glyphs) at
// D (1440x900, 1280x800), P and L for the given levels.   LEVELS=21,34 node scripts/hedgerow-628-measure.mjs
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'http://localhost:4180'
const levels = (process.env.LEVELS ?? '21,34,3').split(',')
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const lv of levels) for (const [s, w, h, touch] of [['D', 1440, 900, false], ['D2', 1280, 800, false], ['P', 390, 844, true], ['L', 844, 390, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })
  const p = await ctx.newPage()
  await p.goto(`${base}/hedgerow/?2d&sandbox=1`)
  await p.evaluate((l) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3])), seenBefore: { [l]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })), lv)
  await p.goto(`${base}/hedgerow/?2d&sandbox=1&level=${lv}`)
  await p.waitForFunction(() => !!window.hedgerow?.game?.(), null, { timeout: 60000 })
  await p.waitForTimeout(1200)
  const r = await p.evaluate(() => [...document.querySelectorAll('.tray-tower')].map((t) => {
    const box = (e) => e ? e.getBoundingClientRect() : null
    const tb = box(t), im = box(t.querySelector('img.tray-icon')), rw = t.querySelector('.tray-role-word'), nm = t.querySelector('.tray-name')
    const rwb = box(rw), vis = (e) => e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && box(e).height > 0
    const clipped = (e) => vis(e) && (box(e).bottom > tb.bottom + 0.5 || box(e).right > tb.right + 0.5 || e.scrollHeight > e.clientHeight + 1)
    const glyphText = [...t.querySelectorAll('*')].filter((e) => vis(e) && /^[✓✕]$/.test([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(''))).length
    return { tight: document.querySelector('.panel')?.className, k: t.dataset.kind, w: Math.round(tb.width), h: Math.round(tb.height), art: im && Math.round(im.height), role: vis(rw) ? parseFloat(getComputedStyle(rw).fontSize) : 0, roleClip: clipped(rw), nameClip: clipped(nm), name: parseFloat(getComputedStyle(nm).fontSize), glyph: glyphText }
  }))
  const min = (k) => Math.min(...r.map((x) => x[k]))
  console.log(lv, s, r[0]?.tight, `n=${r.length} card ${min('w')}x${min('h')} art>=${min('art')} role>=${min('role')} name>=${min('name')} roleClip=${r.filter((x) => x.roleClip).length} nameClip=${r.filter((x) => x.nameClip).length} glyphs=${r.reduce((a, x) => a + x.glyph, 0)}`)
  await ctx.close()
}
await b.close()
