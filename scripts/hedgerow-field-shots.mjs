// AAA UI M3 (docs/design/aaa-ui.md): the Hedgerow field, HUD and upgrade sheet at P (390x844), L (844x390)
// and D (1440x900), in `?2d&sandbox=1`, plus one D shot in 3D to check legibility over the scene.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//        OUT=e2e/screenshots/hedgerow-m3 node scripts/hedgerow-field-shots.mjs
// Set PLAYWRIGHT_CHROMIUM_PATH if the pinned Chromium revision is missing (see CLAUDE.md).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/hedgerow-m3'
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const SIZES = { P: [390, 844], L: [844, 390], D: [1440, 900] }
const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 3]))
const TIPS = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }

async function open(size, level, { mode = '2d', scheme = 'light', reduced = false } = {}) {
  const [w, h] = SIZES[size]
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: size !== 'D', isMobile: size !== 'D' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  const url = `${base}?sandbox=1${mode === '2d' ? '&2d' : ''}`
  await page.goto(url)
  await page.evaluate(([s, l, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars(level - 1), level, TIPS])
  await page.goto(`${url}&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await page.waitForTimeout(mode === '2d' ? 600 : 4000)
  return { page, ctx, errors }
}

/** Places towers near the middle (upgrading along paths), returns the first one's cell. */
async function build(page, builds) {
  return page.evaluate((builds) => {
    const hg = window.hedgerow
    const g = hg.game()
    const plots = []
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) plots.push([c, r])
    plots.sort((a, b) => Math.hypot(a[0] - g.level.cols / 2, a[1] - g.level.rows / 2) - Math.hypot(b[0] - g.level.cols / 2, b[1] - g.level.rows / 2))
    const placed = []
    let i = 0
    for (const [kind, goal] of builds) {
      for (; i < plots.length; i++) {
        const [c, r] = plots[i]
        if (placed.some(([x, y]) => Math.max(Math.abs(x - c), Math.abs(y - r)) < 2)) continue
        if (!hg.place(g, kind, c, r).ok) continue
        const t = g.towers[g.towers.length - 1]
        if (goal && t.path) {
          const order = [0, 1, 2].filter((k) => goal[k] > 0).sort((a, b) => goal[b] - goal[a])
          for (const k of order) while (t.path[k] < Math.min(2, goal[k]) && hg.upgrade(g, t.id, k).ok);
          for (const k of order) while (t.path[k] < goal[k] && hg.upgrade(g, t.id, k).ok);
        }
        placed.push([c, r])
        i++
        break
      }
    }
    hg.refresh()
    return placed[0]
  }, builds)
}

async function select(page, [c, r]) {
  await page.locator('#canvas').focus()
  for (let k = 0; k < 30; k++) {
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowUp')
  }
  for (let k = 0; k < c; k++) await page.keyboard.press('ArrowRight')
  for (let k = 0; k < r; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
}

const shots = []
async function snap(page, name) {
  const path = `${out}/${name}.png`
  await page.screenshot({ path, timeout: 180000 })
  shots.push(path)
}

const BUSY = [['scarecrow', [2, 0, 1]], ['cannon', [1, 2, 0]], ['beehive', [0, 2, 1]], ['hedgerow', [2, 1, 0]], ['mast', [1, 0, 2]], ['scarecrow', [0, 1, 2]]]

for (const size of ['P', 'L', 'D']) {
  // 1. Field with a tower selected: level 6, a Scarecrow on 1-0-0 with its sheet open, between rounds.
  if (!only || only.includes('selected')) {
    for (const variant of size === 'P' ? ['light', 'dark'] : ['light']) {
      const { page, ctx, errors } = await open(size, 6, { scheme: variant })
      const at = await build(page, [['scarecrow', [1, 0, 0]], ['scarecrow', null]])
      if (at) await select(page, at)
      await snap(page, `field-selected-${size}${variant === 'dark' ? '-dark' : ''}`)
      if (errors.length) console.log(size, 'errors', errors.slice(0, 3))
      await ctx.close()
    }
  }
  // 2. The busy level 12: six towers on paths, a round in flight; then a tower's sheet over it.
  if (!only || only.includes('busy')) {
    const { page, ctx, errors } = await open(size, 12)
    const at = await build(page, BUSY)
    await page.evaluate(() => { const hg = window.hedgerow; hg.sendWave(hg.game(), true); hg.refresh() })
    await page.waitForFunction(() => window.hedgerow.game().enemies.length > 6, null, { timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(1500)
    await snap(page, `busy-12-${size}`)
    if (at) await select(page, at)
    await snap(page, `busy-12-selected-${size}`)
    if (errors.length) console.log(size, 'errors', errors.slice(0, 3))
    await ctx.close()
  }
  // 3. Level 30: a tower near its tier 3 on two paths (the crosspath rule shuts the third).
  if (!only || only.includes('tier3')) {
    const { page, ctx } = await open(size, 30)
    const at = await build(page, [['scarecrow', [2, 1, 0]], ['cannon', [3, 0, 0]]])
    if (at) await select(page, at)
    await snap(page, `tier3-${size}`)
    await ctx.close()
  }
}
// 4. One desktop shot in 3D over the busy field, to check every HUD text sits on a material.
if (!only || only.includes('3d')) {
  const { page, ctx } = await open('D', 12, { mode: '3d' })
  await build(page, BUSY)
  await page.evaluate(() => { const hg = window.hedgerow; hg.sendWave(hg.game(), true); hg.refresh() })
  await page.waitForTimeout(8000)
  await snap(page, 'busy-12-3d-D')
  await ctx.close()
}
console.log(shots.join('\n'))
await browser.close()
