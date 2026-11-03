// Plan item 64: Cath's field-guide page for a new drone and a boss, at P, D and L, in 2D and 3D.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4191 &
//   then node scripts/hedgerow-fieldguide-shots.mjs [tag] [2d|3d|both]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] || 'after'
const modes = (process.argv[3] || 'both') === 'both' ? ['2d', '3d'] : [process.argv[3]]
const base = process.env.BASE || 'http://localhost:4191'
const out = 'e2e/screenshots/fieldguide64'
mkdirSync(out, { recursive: true })
const KINDS = ['van', 'courier', 'hatchback', 'pickup', 'sprinter', 'lorry', 'quad', 'wrapped', 'steel', 'artic', 'transporter', 'skip', 'plantdozer', 'crane', 'execcar', 'borer', 'boss', 'drone']
const CASES = [
  { name: 'drone', level: 18, round: 3 },
  { name: 'boss', level: 10, round: 14 },
]
const SIZES = [['P', { width: 390, height: 844 }], ['D', { width: 1440, height: 900 }], ['L', { width: 844, height: 390 }]]
for (const mode of modes) {
  const b = await chromium.launch(mode === '3d' ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {})
  for (const c of CASES)
    for (const [n, vp] of SIZES) {
      const p = await b.newPage({ viewport: vp })
      const URL = `${base}/hedgerow/?${mode === '2d' ? '2d&' : ''}sandbox=1&intro=hold`
      await p.goto(URL)
      await p.evaluate(([l, kinds, k]) => {
        const stars = {}
        for (let i = 1; i < l; i++) stars[String(i)] = 3
        const seen = Object.fromEntries(kinds.filter((x) => x !== k).map((x) => [x, true]))
        localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [l]: true }, seen, tips: { all: true } }))
      }, [c.level, KINDS, c.name])
      await p.goto(`${URL}&level=${c.level}`)
      await p.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
      await p.evaluate((r) => { const hg = window.hedgerow; hg.game().wave = r - 1; hg.sendWave(hg.game(), false); hg.refresh() }, c.round)
      try {
        await p.locator('#intro.intro-page').waitFor({ state: 'visible', timeout: mode === '3d' ? 120000 : 30000 })
        await p.waitForTimeout(mode === '3d' ? 2500 : 900)
        await p.screenshot({ path: `${out}/${c.name}-${mode}-${n}-${tag}.png` })
        console.log('shot', c.name, mode, n)
      } catch (e) {
        console.log('no page', c.name, mode, n, String(e).slice(0, 80))
      }
      await p.close()
    }
  await b.close()
}
