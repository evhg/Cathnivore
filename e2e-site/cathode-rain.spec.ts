import { expect, test } from './own-gpu'

// Plan item 673: the street's rain reads as rain at D. Below full scale (rs=0.5, as dynamic resolution drops to on
// a slow machine) the world used to resolve a 4-sample buffer with the rain's thin additive streaks in it, which
// drew them as dark dotted dashes; the rain is additive, so with it on no pixel may be much darker than with it
// off. And out in the rain a drop lands on the lens now and then (`lensDrop` forces one under ?shot), clear of
// the middle where she aims.

type C = {
  stats: { frames: number }
  lensDrop(): number
  world?: { scene: { traverse(f: (o: { name: string; visible: boolean }) => void): void } }
  scene?: { traverse(f: (o: { name: string; visible: boolean }) => void): void }
}

test('desktop street at half scale: rain never darkens the frame, and a raindrop lands on the lens', async ({ ownBrowser: browser, hasTouch, baseURL }) => {
  test.skip(hasTouch, 'the desktop view (D)')
  test.setTimeout(900_000)
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
  const page = await ctx.newPage()
  await page.goto('/nightshift/?play&class=ghost&shot&rs=0.5')
  await page.waitForFunction(() => ((window as unknown as { cathode?: C }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 300_000 })
  await page.waitForTimeout(2000)
  const frames = async () => {
    const f0 = await page.evaluate(() => (window as unknown as { cathode: C }).cathode.stats.frames)
    await page.waitForFunction((f) => (window as unknown as { cathode: C }).cathode.stats.frames >= f + 2, f0, { timeout: 240_000 })
  }
  const shoot = async () => (await page.screenshot({ timeout: 300_000 })).toString('base64')
  // Pixels of `a` 45+ levels darker / 20+ levels changed against `b`: whole frame, the tower windows, the middle third.
  const diff = (a: string, b: string) =>
    page.evaluate(async ([a, b]) => {
      const load = async (s: string) => {
        const i = new Image()
        i.src = `data:image/png;base64,${s}`
        await i.decode()
        const cv = document.createElement('canvas')
        cv.width = i.width
        cv.height = i.height
        const x = cv.getContext('2d')!
        x.drawImage(i, 0, 0)
        return x.getImageData(0, 0, i.width, i.height)
      }
      const A = await load(a!)
      const B = await load(b!)
      let darker = 0
      let darkerWindows = 0
      let changedLeft = 0
      for (let y = 0; y < A.height; y++)
        for (let x = 0; x < A.width; x++) {
          const i = (y * A.width + x) * 4
          const d = (A.data[i]! + A.data[i + 1]! + A.data[i + 2]! - B.data[i]! - B.data[i + 1]! - B.data[i + 2]!) / 3
          if (d <= -45 && x < 900 && y < 700) {
            darker++
            if (x >= 560 && x < 900 && y >= 60 && y < 330) darkerWindows++
          }
          // Left of the Pin (its idle sway moves it between frames even under ?shot).
          if (Math.abs(d) >= 20 && x < 880 && y < 700) changedLeft++
        }
      return { darker, darkerWindows, changedLeft }
    }, [a, b])

  const on = await shoot()
  await page.evaluate(() => {
    const c = (window as unknown as { cathode: C }).cathode
    ;(c.world?.scene ?? c.scene)!.traverse((o) => {
      if (o.name === 'rain') o.visible = false
    })
  })
  await frames()
  const off = await shoot()
  const rain = await diff(on, off)
  // Before the fix: 153 (and 46-52 in the windows); after: 0 and 0. A little room for SwiftShader's noise.
  expect(rain.darker, JSON.stringify(rain)).toBeLessThanOrEqual(20)
  expect(rain.darkerWindows, JSON.stringify(rain)).toBeLessThanOrEqual(5)

  const drops = await page.evaluate(() => {
    const c = (window as unknown as { cathode: C }).cathode
    c.lensDrop()
    return c.lensDrop()
  })
  expect(drops).toBe(2)
  await frames()
  const wet = await diff(await shoot(), off)
  // Measured 92 at rs=0.5 against 0 between two identical frames. The seeded first two drops land left of the Pin (about 380,485 and 900,290 at 1440x900): the street bends
  // through them (the rain is still hidden, so only the drops differ left of the Pin).
  const base = await diff(off, off)
  expect(base.changedLeft).toBe(0)
  expect(wet.changedLeft, JSON.stringify({ wet, rain })).toBeGreaterThanOrEqual(40)
  await ctx.close()
})
