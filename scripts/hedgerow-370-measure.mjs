import { chromium } from '@playwright/test'
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
for (const level of (process.env.LEVELS ?? '21,34').split(',').map(Number)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4180/hedgerow/?sandbox=1&2d')
  await page.evaluate((l) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: l - 1 }, (_, i) => [String(i + 1), 3])), seenBefore: { [l]: true }, tips: { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true } })), level)
  await page.goto(`http://localhost:4180/hedgerow/?sandbox=1&2d&level=${level}`)
  await page.waitForFunction(() => !!window.hedgerow?.game(), null, { timeout: 60000 })
  await page.waitForTimeout(1500)
  const buf = await page.screenshot({ clip: { x: 20, y: 80, width: 1060, height: 800 } })
  if (process.env.SAVE) (await import('node:fs')).writeFileSync(`${process.env.SAVE}-l${level}.png`, buf)
  const r = await page.evaluate(async (b) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b}`)).blob())
    const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, img.width, img.height).data
    let s = 0, l = 0, n = 0
    for (let i = 0; i < d.length; i += 16) { const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255; const mx = Math.max(R, G, B), mn = Math.min(R, G, B); s += mx ? (mx - mn) / mx : 0; l += 0.2126 * R + 0.7152 * G + 0.0722 * B; n++ }
    return { sat: +(s / n).toFixed(3), lum: +(l / n).toFixed(3) }
  }, buf.toString('base64'))
  console.log(level, JSON.stringify(r))
  await ctx.close()
}
await browser.close()
