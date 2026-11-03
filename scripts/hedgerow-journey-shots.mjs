// Plan item 73: the Hedgerow journey map, fresh (0), mid (6) and complete (act 1 done, 13 levels) saves at P and D,
// light and dark, into /tmp/claude-0/b73/<tag>-<size>-<upTo>-<scheme>.png; logs node sizes and label overlaps.
//   SITE_OUT=... npx tsx scripts/build-site.ts --only=hedgerow && npx vite preview --outDir ... --port 4195 &
//   node scripts/hedgerow-journey-shots.mjs http://localhost:4195 <tag>
import { chromium } from '@playwright/test'
const [base, tag] = [process.argv[2], process.argv[3]]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const scheme of (process.env.SCHEMES ?? 'light').split(','))
for (const [n, w, h, touch] of [['P', 390, 844, true], ['D', 1440, 900, false]])
for (const upTo of (process.env.UPTO ?? '0,6,13').split(',').map(Number)) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme })).newPage()
  await p.goto(`${base}/hedgerow/?2d`)
  await p.evaluate((n) => {
    const stars = {}, seenBefore = {}
    for (let i = 1; i <= n; i++) { stars[i] = 3; seenBefore[i] = true }
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: {}, bank: {} }))
  }, upTo)
  await p.reload()
  await p.waitForTimeout(1800)
  await p.screenshot({ path: `/tmp/claude-0/b73/${tag}-${n}-${upTo}-${scheme}.png` })
  await p.context().close()
}
await b.close()
