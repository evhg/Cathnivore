// Plan item 319: a 3x crop of Cath's chest (collar, lapels, blouse) on the NIGHT SHIFT title or class pick at D.
// Needs a dist-site preview on :4190. Usage: OUT=<dir> CLASS=ghost node scripts/cathode-chest-zoom.mjs <tag> [title|classpick]
import { chromium } from '@playwright/test'
const [tag, front = 'title'] = process.argv.slice(2)
const out = process.env.OUT, cls = process.env.CLASS || 'ghost'
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const vp = { width: 1440, height: 900 }
const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 3 })
const p = await ctx.newPage()
await p.goto('http://localhost:4190/nightshift/?shot')
await p.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
await p.goto(`http://localhost:4190/nightshift/?front=${front}&shot&t=${process.env.T || 8}&quality=phone${front === 'classpick' ? `&class=${cls}` : ''}`)
await p.waitForFunction(() => window.cathodeFront?.ready === true, null, { timeout: 200000 })
await p.waitForTimeout(3000)
const f = await p.evaluate(() => window.cathodeFront.scene().faceBox())
const w = f.right - f.left, h = f.bottom - f.top
await p.screenshot({ path: `${out}/${tag}-${front}-chest.png`, clip: { x: f.left - w * 1.4, y: f.top - h*0.2, width: w * 3.8, height: h * 3.4 }, timeout: 180000 })
await b.close()
