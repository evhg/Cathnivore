// Plan item 38: fresh key art for the portfolio and /games/, shot from the games themselves. Each game's hero
// state at 1440x900 (the Cathnivore table at round 7, a solved Runnel daily, a late Hedgerow round in flight,
// Cath on the NIGHT SHIFT title street), written as WebP at 1440, 960 and 640 px wide into
// portfolio/public/work/games-<game>[-960|-640].webp, the sizes the hero's srcset offers.
// No image library is installed: Chromium encodes the WebP (canvas.toDataURL) in a blank page.
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &
//   npm run keyart            (or: node scripts/keyart.mjs [cathnivore runnel hedgerow nightshift])
// Set PLAYWRIGHT_CHROMIUM_PATH if the pinned Chromium revision is missing (see CLAUDE.md). Review the files
// and commit them; this runs on `build`, never inside a release, so the art ships only once CI has seen it.
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { KEYART_MANIFEST, keyartHash } from './keyart-sources.mjs'

const base = (process.env.SITE_URL ?? 'http://localhost:4186').replace(/\/$/, '')
const out = process.env.KEYART_OUT ?? 'portfolio/public/work'
const want = process.argv.slice(2).length ? process.argv.slice(2) : ['cathnivore', 'runnel', 'hedgerow', 'nightshift']
const SIZES = [1440, 960, 640]
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const page = async () => (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage()

/** Encodes an image (base64 PNG or WebP) as WebP at each width; returns [width, bytes][] */
async function encode(b64, mime) {
  const enc = await browser.newPage()
  const outs = await enc.evaluate(
    async ([src, sizes]) => {
      const img = new Image()
      img.src = src
      await img.decode()
      return sizes.map((w) => {
        const h = Math.round((img.naturalHeight / img.naturalWidth) * w)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, 0, 0, w, h)
        return [w, c.toDataURL('image/webp', w >= 1440 ? 0.8 : 0.74).split(',')[1]]
      })
    },
    [`data:${mime};base64,${b64}`, SIZES],
  )
  await enc.close()
  return outs
}

async function write(name, b64, mime = 'image/png') {
  for (const [w, data] of await encode(b64, mime)) {
    const file = `${out}/games-${name}${w === 1440 ? '' : `-${w}`}.webp`
    writeFileSync(file, Buffer.from(data, 'base64'))
    console.log(file, Math.round(Buffer.from(data, 'base64').length / 1024), 'KB')
  }
}

const shoot = {
  // The market table late in a Quick Game: the autoplay stops when round 7 begins.
  async cathnivore() {
    const p = await page()
    await p.goto(`${base}/cathnivore/?keyart&e2eAutoplay=1&e2eAutoplayUntil=7`)
    await p.getByText('Quick Game').click()
    await p.getByRole('button', { name: 'Start' }).click()
    const round = () => p.evaluate(() => Number(document.querySelector('.map-wrap svg.map[data-round]')?.dataset.round ?? 0))
    let last = -1
    for (let i = 0; i < 120; i++) {
      const now = await round()
      if (now >= 7 || (now === last && now > 3)) break
      last = now
      await p.waitForTimeout(700)
    }
    await p.waitForTimeout(2500)
    return (await p.screenshot()).toString('base64')
  },
  // Today's daily, really solved: the test hook turns every tile but one, a tap on that one waters the farm
  // (a fresh browser profile, so nothing is saved anywhere real), then the win sheet is closed.
  async runnel() {
    const p = await page()
    await p.goto(`${base}/runnel/?keyart&nohelp&sky=noon,clouds`)
    await p.waitForFunction(() => !!window.runnelTest)
    await p.evaluate(() => window.runnelTest.nearlySolve())
    await p.locator('#board [data-last]').click()
    // The win's strip (hidden by `?keyart`) comes up once the river has run out to every field.
    await p.waitForFunction(() => document.body.classList.contains('has-win-strip'), null, { timeout: 20000 })
    await p.waitForTimeout(1500)
    return (await p.screenshot()).toString('base64')
  },
  // Level 30 in the 2D field: six towers grown along their paths and a round in flight.
  async hedgerow() {
    const p = await page()
    const stars = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [String(i + 1), 3]))
    const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
    await p.goto(`${base}/hedgerow/?sandbox=1&2d`)
    await p.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 30: true }, tips: t })), [stars, tips])
    await p.goto(`${base}/hedgerow/?keyart&sandbox=1${process.env.KEYART_HEDGEROW_3D ? '' : '&2d'}&level=30`)
    await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
    await p.waitForTimeout(800)
    await p.evaluate(() => {
      const BUSY = [['scarecrow', [2, 0, 1]], ['cannon', [1, 2, 0]], ['beehive', [0, 2, 1]], ['hedgerow', [2, 1, 0]], ['mast', [1, 0, 2]], ['scarecrow', [0, 1, 2]]]
      const hg = window.hedgerow
      const g = hg.game()
      const plots = []
      for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) plots.push([c, r])
      plots.sort((a, b) => Math.hypot(a[0] - g.level.cols / 2, a[1] - g.level.rows / 2) - Math.hypot(b[0] - g.level.cols / 2, b[1] - g.level.rows / 2))
      const placed = []
      let i = 0
      for (const [kind, goal] of BUSY) {
        for (; i < plots.length; i++) {
          const [c, r] = plots[i]
          if (placed.some(([x, y]) => Math.max(Math.abs(x - c), Math.abs(y - r)) < 2)) continue
          if (!hg.place(g, kind, c, r).ok) continue
          const t = g.towers[g.towers.length - 1]
          if (t.path) for (const k of [0, 1, 2]) while (t.path[k] < goal[k] && hg.upgrade(g, t.id, k).ok);
          placed.push([c, r])
          i++
          break
        }
      }
      hg.sendWave(g, true)
      hg.refresh()
    })
    await p.waitForFunction(() => window.hedgerow.game().enemies.length > 8, null, { timeout: 60000 }).catch(() => {})
    await p.waitForTimeout(2500)
    return (await p.screenshot()).toString('base64')
  },
  // The Drowned Market street, from NIGHT SHIFT's own key art (scripts/cathode-keyart.mjs renders it from the
  // game; WebGL under SwiftShader is too slow to render it again here).
  // Plan item 203: the title's street as a lit noir poster: Cath under her umbrella in the neon key light, the left
  // of the frame kept dark for the wordmark. The title scene frozen (`?shot`) at quality high, every DOM layer hidden.
  async nightshift() {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
    const p = await ctx.newPage()
    await p.goto(`${base}/nightshift/?shot&quality=high`, { timeout: 120_000 })
    // Under SwiftShader the street is drawn by about 30 s (plan-shots.mjs).
    await p.waitForTimeout(40_000)
    await p.evaluate(() => {
      for (const el of document.querySelectorAll('body *')) if (el.tagName !== 'CANVAS' && !el.querySelector('canvas')) el.style.visibility = 'hidden'
    })
    await p.waitForTimeout(1500)
    const b64 = (await p.screenshot()).toString('base64')
    await ctx.close()
    return b64
  },
}

const manifest = existsSync(KEYART_MANIFEST) ? JSON.parse(readFileSync(KEYART_MANIFEST, 'utf8')) : {}
for (const name of want) {
  if (!shoot[name]) throw new Error(`unknown game: ${name}`)
  const shot = await shoot[name]()
  if (typeof shot === 'string') await write(name, shot)
  else await write(name, shot.b64, shot.mime)
  // Plan item 116: what this art was drawn from (tests/keyart-fresh.test.ts). Only for the real output folder.
  if (out === 'portfolio/public/work') manifest[name] = keyartHash(name)
}
if (out === 'portfolio/public/work') writeFileSync(KEYART_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
await browser.close()
