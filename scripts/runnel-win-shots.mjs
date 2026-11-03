// Plan item 68: a real solve (`?shotsolve`, then the last tap) shot mid-celebration and with the result up, at P and
// D, light and dark, into /tmp/claude-0/b68/<tag>-<size>-<scheme>-<ms>.png; logs the board's visible share and blur.
//   SITE_OUT=... npx tsx scripts/build-site.ts --only=runnel && npx vite preview --outDir ... --port 4194 &
//   node scripts/runnel-win-shots.mjs http://localhost:4194 <tag>
import { chromium } from '@playwright/test'
const [base, tag] = [process.argv[2], process.argv[3]]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const scheme of (process.env.SCHEMES ?? 'light,dark').split(','))
for (const [n, w, h, touch] of [['P', 390, 844, true], ['D', 1440, 900, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme })
  const p = await ctx.newPage()
  await p.goto(`${base}/runnel/?nohelp&shotsolve&sky=noon,clear`)
  await p.waitForSelector('[data-last]')
  await p.waitForTimeout(500)
  await p.locator('[data-last]').click()
  let t = 0
  for (const ms of (process.env.TIMES ?? '700,3200').split(',').map(Number)) {
    await p.waitForTimeout(ms - t); t = ms
    const m = await p.evaluate(() => {
      const bd = document.getElementById('board').getBoundingClientRect()
      const blur = [...document.querySelectorAll('dialog[open]')].map((d) => getComputedStyle(d, '::backdrop').backdropFilter)
      // The share of the board's box not covered by an open dialog's visible box.
      const cover = [...document.querySelectorAll('dialog[open], .win-strip:not([hidden])')].map((d) => d.getBoundingClientRect())
      let hidden = 0
      for (const c of cover) hidden += Math.max(0, Math.min(bd.right, c.right) - Math.max(bd.left, c.left)) * Math.max(0, Math.min(bd.bottom, c.bottom) - Math.max(bd.top, c.top))
      return { board: [Math.round(bd.top), Math.round(bd.bottom)], visible: Math.round(100 * (1 - hidden / (bd.width * bd.height))), blur, scroll: document.scrollingElement.scrollHeight - innerHeight }
    })
    console.log(n, scheme, ms, JSON.stringify(m))
    await p.screenshot({ path: `/tmp/claude-0/b68/${tag}-${n}-${scheme}-${ms}.png` })
  }
  await ctx.close()
}
await b.close()
