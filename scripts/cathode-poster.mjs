// Plan item 65: the front door's poster. Boots the title (high quality), waits until the live street has drawn and
// settled, hides every piece of UI, and writes the frame as WebP posters the page shows before WebGL is up:
// games/cathode/public/front-poster-{1440,960,640}.webp (landscape) and front-poster-portrait-{780,520}.webp.
//   npm run build:site && npx vite preview --outDir dist-site --port 4186 &   then
//   CATHODE_URL=http://localhost:4186/nightshift/ node scripts/cathode-poster.mjs
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { POSTER_MANIFEST, posterHash } from './keyart-sources.mjs'
const base = process.env.CATHODE_URL ?? 'http://localhost:4186/nightshift/'
const out = process.env.OUT ?? 'games/cathode/public'
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
async function encode(png, widths) {
  const p = await b.newPage()
  const r = await p.evaluate(
    async ([src, ws]) => {
      const img = new Image()
      img.src = src
      await img.decode()
      return ws.map((w) => {
        const h = Math.round((img.naturalHeight / img.naturalWidth) * w)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, 0, 0, w, h)
        return [w, c.toDataURL('image/webp', 0.72).split(',')[1]]
      })
    },
    [`data:image/png;base64,${png.toString('base64')}`, widths],
  )
  await p.close()
  return r
}
for (const [name, vw, vh, widths] of [['front-poster', 1440, 900, [1440, 960, 640]], ['front-poster-portrait', 390, 844, [780, 520]]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: name.includes('portrait') ? 2 : 1 })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
  const p = await ctx.newPage()
  await p.goto(base)
  await p.waitForFunction(() => (window.cathodeFront?.scene?.()?.stats?.frames ?? 0) > 4, null, { timeout: 400_000 })
  // Plan item 473: a stirring pointer keeps the title's idle push (item 187: after 6 s the lens dollies in to her
  // face) from starting, so the poster is the title's own framing. Upright, that push had pushed her face into the
  // corner over The List, and the phone poster (what a phone shows first) caught it mid-dolly.
  // (round the centre, so its parallax stays at about zero: a move of 2%+ of the width resets the idle clock)
  let side = 1
  const stir = setInterval(() => void p.mouse.move(vw / 2 + (side = -side) * vw * 0.02, vh / 2).catch(() => {}), 1500)
  await p.waitForTimeout(6000)
  await p.addStyleTag({ content: '.screen, .front-bars, .front-grain, .front-fallback, #loading, .boot { visibility: hidden !important; }' })
  await p.waitForTimeout(2500)
  clearInterval(stir)
  const push = await p.evaluate(() => document.querySelector('canvas[data-idle-push]')?.dataset.idlePush ?? 'none')
  console.log(name, 'idle push at the shot', push)
  const png = await p.screenshot()
  for (const [w, data] of await encode(png, widths)) {
    const file = `${out}/${name}-${w}.webp`
    writeFileSync(file, Buffer.from(data, 'base64'))
    console.log(file, Math.round(Buffer.from(data, 'base64').length / 1024), 'KB')
  }
  await ctx.close()
}
await b.close()
// Plan item 363: record what the posters were rendered from (tests/keyart-fresh.test.ts fails once it changes).
if (out === 'games/cathode/public') writeFileSync(POSTER_MANIFEST, `${JSON.stringify({ hash: posterHash() }, null, 2)}\n`)
