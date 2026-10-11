// ROADMAP 104: Hedgerow screenshots (level map plus a mid-wave field, 2D and 3D) into e2e/screenshots/.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/hedgerow-shots.mjs
// Set PLAYWRIGHT_CHROMIUM_PATH if the pinned Chromium revision is missing (see CLAUDE.md).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
mkdirSync('e2e/screenshots', { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
for (const [name, w, h] of [['phone', 844, 390], ['desktop', 1440, 900]]) {
  for (const mode of ['2d', '3d']) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(`${base}?sandbox=1${mode === '2d' ? '&2d' : ''}`)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `e2e/screenshots/${name}-hedgerow-map-${mode}.png` })
    await page.locator('button.node:not([disabled])').first().click()
    for (let i = 0; i < 12 && !(await page.locator('#screen-play:visible').count()); i++) {
      const next = page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first()
      if (await next.count()) await next.click().catch(() => {})
      await page.waitForTimeout(400)
    }
    await page.evaluate(async () => {
      const hg = window.hedgerow
      const g = hg.game()
      const kinds = ['scarecrow', 'beehive', 'hedgerow', 'stall', 'pond', 'barn']
      let k = 0
      // Spread towers over the whole map: walk every cell with a stride coprime to the cell count.
      const n = g.level.rows * g.level.cols
      let stride = 7
      while (n % stride === 0) stride += 2
      for (let i = 0; i < n && k < 8; i++) {
        const idx = (i * stride) % n
        if (hg.place(g, kinds[k % kinds.length], idx % g.level.cols, Math.floor(idx / g.level.cols)).ok) k++
      }
      hg.sendWave(g, true)
    })
    await page.waitForTimeout(mode === '2d' ? 3000 : 6000)
    await page.screenshot({ path: `e2e/screenshots/${name}-hedgerow-field-${mode}.png` })
    await page.close()
  }
}
// Hedgerow 2 M4: towers on upgrade paths. Level 30 (fleet rules, all five path towers, tier 3 open): two
// Scarecrows side by side on different paths, the other path towers at their tier 3s, a round in flight, then a
// Scarecrow's path sheet (a bottom sheet on the phone).
for (const [name, w, h] of [['phone', 844, 390], ['desktop', 1440, 900]]) {
  for (const mode of ['2d', '3d']) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(`${base}?sandbox=1&level=30${mode === '2d' ? '&2d' : ''}`)
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { 30: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true } })))
    await page.reload()
    await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 30000 })
    await page.waitForTimeout(800)
    const sel = await page.evaluate(() => {
      const hg = window.hedgerow
      const g = hg.game()
      // Plots next to the lane, nearest the middle of the field first.
      const plots = []
      for (let r = 0; r < g.level.rows; r++)
        for (let c = 0; c < g.level.cols; c++) plots.push([c, r])
      plots.sort((a, b) => Math.hypot(a[0] - g.level.cols / 2, a[1] - g.level.rows / 2) - Math.hypot(b[0] - g.level.cols / 2, b[1] - g.level.rows / 2))
      const builds = [
        ['scarecrow', [3, 0, 2]],
        ['scarecrow', [0, 2, 3]],
        ['scarecrow', [2, 3, 0]],
        ['cannon', [3, 2, 0]],
        ['beehive', [0, 2, 3]],
        ['hedgerow', [0, 2, 3]],
        ['mast', [2, 0, 3]],
        ['hedgerow', [3, 2, 0]],
      ]
      const placed = []
      let i = 0
      for (const [kind, goal] of builds) {
        for (; i < plots.length; i++) {
          const [c, r] = plots[i]
          if (!hg.place(g, kind, c, r).ok) continue
          const t = g.towers[g.towers.length - 1]
          // Main path to 2, the other path, then the main path's tier 3.
          const order = [0, 1, 2].filter((k) => goal[k] > 0).sort((a, b) => goal[b] - goal[a])
          for (const k of order) while (t.path[k] < Math.min(2, goal[k]) && hg.upgrade(g, t.id, k).ok);
          for (const k of order) while (t.path[k] < goal[k] && hg.upgrade(g, t.id, k).ok);
          placed.push([c, r])
          i++
          break
        }
      }
      hg.sendWave(g, true)
      return placed[0]
    })
    await page.waitForTimeout(mode === '2d' ? 3500 : 8000)
    await page.screenshot({ path: `e2e/screenshots/${name}-hedgerow-paths-${mode}.png` })
    if (mode === '2d' && sel) {
      // The first Scarecrow's sheet: the keyboard cursor walks to its plot, Enter selects it.
      await page.locator('#canvas').focus()
      for (let k = 0; k < 30; k++) {
        await page.keyboard.press('ArrowLeft')
        await page.keyboard.press('ArrowUp')
      }
      for (let k = 0; k < sel[0]; k++) await page.keyboard.press('ArrowRight')
      for (let k = 0; k < sel[1]; k++) await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(600)
      await page.screenshot({ path: `e2e/screenshots/${name}-hedgerow-sheet-${mode}.png` })
    }
    await page.close()
  }
}
await browser.close()
