// Plan item 67: the Quick Game Setup at D (1440x900, 1280x800) and P, light and dark, into /tmp/claude-0/b67/<tag>-<size>-<scheme>.png.
//   npm run build && npx vite preview --port 4191 &  then  node scripts/cathnivore-setup-shots.mjs http://localhost:4191 <tag>
import { chromium } from '@playwright/test'
const [base, tag] = [process.argv[2], process.argv[3]]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const sizes = [['D', 1440, 900, false], ['D2', 1280, 800, false], ['P', 390, 844, true]]
for (const scheme of (process.env.SCHEMES ?? 'light,dark').split(','))
for (const [n, w, h, touch] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme })
  const p = await ctx.newPage()
  await p.goto(base + '/')
  await p.getByText('Quick Game').click()
  await p.getByRole('heading', { name: 'Quick Game' }).waitFor()
  await p.waitForTimeout(600)
  const m = await p.evaluate(() => ({ scroll: document.scrollingElement.scrollHeight - innerHeight, start: (() => { const r = document.querySelector('.setup-start').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] })(), maps: [...document.querySelectorAll('.layout-tile')].map((t) => Math.round(t.getBoundingClientRect().width)) }))
  console.log(n, scheme, JSON.stringify(m))
  await p.screenshot({ path: `/tmp/claude-0/b67/${tag}-${n}-${scheme}.png` })
  await ctx.close()
}
await b.close()
