// Plan item 45: a packed late round on level 38 (sandbox: a round sent and 160 vehicles spawned over three cells
// of lane), shot at D, P and L in 2D (and 3D with MODES=2d,3d) into /tmp/claude-0/sw/<tag>-<mode>-<size>.png.
//   node scripts/hedgerow-swarm-shots.mjs http://localhost:<port> <tag>
import { chromium } from '@playwright/test'
const [base, tag] = [process.argv[2], process.argv[3]]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const modes = (process.env.MODES ?? '2d').split(',')
for (const mode of modes)
for (const [n, w, h, touch] of [['D', 1440, 900, false], ['P', 390, 844, true], ['L', 844, 390, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch })
  const p = await ctx.newPage()
  const stars = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await p.goto(`${base}/hedgerow/?sandbox=1&2d`)
  await p.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 38: true }, tips: t })), [stars, tips])
  await p.goto(`${base}/hedgerow/?sandbox=1${mode === '2d' ? '&2d' : ''}&level=38`)
  await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 120000 })
  await p.addStyleTag({ content: '#intro { display: none !important; }' })
  await p.waitForTimeout(1500)
  await p.evaluate(() => {
    const hg = window.hedgerow
    const g = hg.game()
    hg.sendWave(g, true)
    const kinds = ['hatchback', 'courier', 'quad', 'lorry', 'drone']
    for (let i = 0; i < 160; i++) hg.spawn(kinds[i % 5], 9 + ((i * 37) % 31) / 10)
  })
  await p.waitForTimeout(mode === '2d' ? 700 : 6000)
  const cnt = await p.evaluate(() => window.hedgerow.game().enemies.length)
  await p.screenshot({ path: `/tmp/claude-0/sw/${tag}-${mode}-${n}.png` })
  console.log(tag, mode, n, cnt, 'enemies')
  await ctx.close()
}
await b.close()
