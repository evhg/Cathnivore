// Plan item 58: the office's mean frame luminance at spawn (the room as Cath walks in), per size and quality,
// measured from a screenshot in the page (Rec. 709 luma of sRGB pixels, 0-1). The acceptance bar: 40% up on the
// 2026-11-03 room. Prints one line per case; SHOT=<dir> also saves the frames.
//   CATHODE_URL=http://localhost:<port>/nightshift/ node scripts/cathode-office-luma.mjs
import { chromium } from '@playwright/test'
const base = process.env.CATHODE_URL ?? 'http://localhost:4196/nightshift/'
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const CASES = (process.env.CASES ?? 'D:high,L:phone').split(',').map((c) => c.split(':'))
const VP = { D: { width: 1440, height: 900 }, L: { width: 844, height: 390 } }
for (const [size, quality] of CASES) {
  const ctx = await b.newContext({ viewport: VP[size], hasTouch: size === 'L', isMobile: size === 'L' })
  await ctx.addInitScript((q) => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: q })), quality)
  const p = await ctx.newPage()
  await p.goto(`${base}?play&shot&district=office`)
  await p.waitForFunction(() => (window.cathode?.stats?.frames ?? 0) > 2, null, { timeout: 300_000 })
  await p.evaluate(() => {
    document.getElementById('loading')?.setAttribute('hidden', '')
    document.getElementById('front-fallback')?.classList.add('is-off')
    for (const el of document.querySelectorAll('.hud, #hud, .touch')) el.style.visibility = 'hidden'
  })
  await p.waitForTimeout(4000)
  const png = await p.screenshot()
  if (process.env.SHOT) await p.screenshot({ path: `${process.env.SHOT}/office-luma-${size}-${quality}.png` })
  const luma = await p.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const lin = (v) => {
      v /= 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    let s = 0
    for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
    return s / (d.length / 4)
  }, `data:image/png;base64,${png.toString('base64')}`)
  console.log(`${size} ${quality}: mean luminance ${luma.toFixed(4)}`)
  await ctx.close()
}
await b.close()
