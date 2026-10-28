// AAA UI M1: portfolio screenshots through the shared helper (e2e-site/helpers/shots.ts).
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//   npm run shots:portfolio                    landing and Runnel (P 390x844, L 844x390, D 1440x900)
//   npm run shots:portfolio -- --all           plus Hedgerow, CATHODE and Cathnivore key screens
//
// Env: SITE_URL (default http://localhost:4180), SHOTS_DIR (default e2e/screenshots/portfolio),
// PLAYWRIGHT_CHROMIUM_PATH (see CLAUDE.md). Prints CSP violations, page errors and the computed font of
// one counter per game (the M1 figures-face check). Kill any stale preview server before trusting a run.
import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { shoot, guardCsp, contrastWalk } from '../e2e-site/helpers/shots.ts'
import { dailyPuzzle, tapsToSolve, utcDateString } from '../games/runnel/src/engine.ts'

const base = (process.env.SITE_URL ?? 'http://localhost:4180').replace(/\/$/, '')
const dir = process.env.SHOTS_DIR ?? 'e2e/screenshots/portfolio'
const all = process.argv.includes('--all')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const report = { csp: [], errors: [], fonts: {}, contrast: {} }
const PLD = ['P', 'L', 'D']

async function fresh(path, { webgl = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const g = guardCsp(page)
  await page.goto(base + path)
  await page.waitForTimeout(webgl ? 2500 : 600)
  return { ctx, page, g }
}

async function done({ ctx, g }, label) {
  report.csp.push(...g.csp.map((t) => `${label}: ${t}`))
  report.errors.push(...g.errors.map((t) => `${label}: ${t}`))
  await ctx.close()
}

async function fontOf(page, selector) {
  return page.evaluate(async (sel) => {
    await document.fonts.ready
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    const fam = cs.fontFamily
    const first = fam.split(',')[0].trim().replace(/^["']|["']$/g, '')
    return {
      family: fam,
      numeric: cs.fontVariantNumeric,
      loaded: document.fonts.check(`${cs.fontWeight} 16px "${first}"`, el.textContent || '0'),
    }
  }, selector)
}

const want = (name) => !only || only.split(',').includes(name)

// ---- Landing ----
if (want('landing')) {
  const s = await fresh('/')
  await shoot(s.page, 'landing-hero', PLD, { dir, variants: ['light', 'dark', 'reduced'], settle: (p) => p.waitForTimeout(1600) })
  await shoot(s.page, 'landing-full', ['P', 'D'], { dir, fullPage: true, variants: ['light', 'dark'], settle: (p) => p.waitForTimeout(800) })
  report.contrast.landing = await contrastWalk(s.page)
  report.fonts.landing = await fontOf(s.page, 'h1')
  await done(s, 'landing')
}

// ---- Runnel ----
if (want('runnel')) {
  let s = await fresh('/runnel/')
  await shoot(s.page, 'runnel-help', PLD, { dir, variants: ['light', 'dark'] })
  await s.page.getByRole('button', { name: 'Start' }).click()
  await shoot(s.page, 'runnel-puzzle', PLD, { dir, variants: ['light', 'dark', 'reduced'] })
  report.fonts.runnel = await fontOf(s.page, '#hud-taps')
  report.contrast.runnel = await contrastWalk(s.page)
  await s.page.locator('#btn-stats').click()
  await shoot(s.page, 'runnel-stats', ['P', 'D'], { dir })
  await s.page.keyboard.press('Escape')
  await done(s, 'runnel')

  s = await fresh('/runnel/?nohelp')
  const puzzle = dailyPuzzle(utcDateString(new Date()))
  const cells = s.page.locator('.tiles > g.cell')
  for (let i = 0; i < puzzle.cells.length; i++) {
    const n = tapsToSolve(puzzle.cells[i])
    for (let k = 0; k < n; k++) await cells.nth(i).click({ force: true })
  }
  await s.page.getByRole('heading', { name: 'Every field is watered.' }).waitFor()
  await s.page.waitForTimeout(1500)
  await shoot(s.page, 'runnel-win', PLD, { dir, variants: ['light', 'dark'], settle: (p) => p.waitForTimeout(900) })
  report.fonts['runnel-win'] = await fontOf(s.page, '#win-taps')
  await done(s, 'runnel-win')
}

if (all && want('hedgerow')) {
  const s = await fresh('/hedgerow/?2d&sandbox=1')
  await shoot(s.page, 'hedgerow-map', PLD, { dir, settle: (p) => p.waitForTimeout(700) })
  await s.page.locator('button.node:not([disabled])').first().click()
  await s.page.waitForTimeout(800)
  await shoot(s.page, 'hedgerow-story', ['L', 'D'], { dir })
  for (let i = 0; i < 14 && !(await s.page.locator('#screen-play:visible').count()); i++) {
    const next = s.page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first()
    if (await next.count()) await next.click().catch(() => {})
    await s.page.waitForTimeout(350)
  }
  await s.page.evaluate(() => {
    const hg = window.hedgerow
    const g = hg.game()
    const kinds = ['scarecrow', 'beehive', 'hedgerow', 'stall']
    let k = 0
    const n = g.level.rows * g.level.cols
    for (let i = 0; i < n && k < 5; i++) {
      const idx = (i * 7) % n
      if (hg.place(g, kinds[k % kinds.length], idx % g.level.cols, Math.floor(idx / g.level.cols)).ok) k++
    }
    hg.sendWave(g, true)
  })
  await s.page.waitForTimeout(2500)
  await shoot(s.page, 'hedgerow-field', PLD, { dir, settle: (p) => p.waitForTimeout(900) })
  report.fonts.hedgerow = await fontOf(s.page, '#hud-goodwill')
  await done(s, 'hedgerow')
}

if (all && want('cathode')) {
  let s = await fresh('/nightshift/', { webgl: true })
  await shoot(s.page, 'cathode-gate', PLD, { dir, settle: (p) => p.waitForTimeout(1500) })
  await s.page.locator('#gate-yes').click()
  await s.page.waitForTimeout(1500)
  await shoot(s.page, 'cathode-title', PLD, { dir, settle: (p) => p.waitForTimeout(1500) })
  await done(s, 'cathode-front')

  s = await fresh('/nightshift/?play&shot', { webgl: true })
  await s.page.waitForTimeout(8000)
  await shoot(s.page, 'cathode-hud', ['L', 'D'], { dir, settle: (p) => p.waitForTimeout(4000) })
  report.fonts.cathode = await fontOf(s.page, '.hud-hp-text')
  await done(s, 'cathode-hud')
}

if (all && want('cathnivore')) {
  const s = await fresh('/cathnivore/')
  await s.page.waitForTimeout(1600)
  await shoot(s.page, 'cathnivore-title', PLD, { dir, variants: ['light', 'dark'], settle: (p) => p.waitForTimeout(1600) })
  await s.page.getByText('Quick Game').click()
  await shoot(s.page, 'cathnivore-setup', ['P', 'D'], { dir })
  await s.page.getByRole('button', { name: 'Start' }).click()
  await s.page.locator('.game').waitFor()
  await shoot(s.page, 'cathnivore-game', PLD, { dir, variants: ['light', 'dark'], settle: (p) => p.waitForTimeout(700) })
  report.fonts.cathnivore = await fontOf(s.page, '.game .hud-value .num')
  report.contrast.cathnivore = await contrastWalk(s.page)
  await done(s, 'cathnivore')
}

await browser.close()
writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ csp: report.csp, errors: report.errors, fonts: report.fonts, contrastFails: Object.fromEntries(Object.entries(report.contrast).map(([k, v]) => [k, v.length])) }, null, 2))
