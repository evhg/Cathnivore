import { expect, test } from '@playwright/test'

// Plan item 713: Cath has presence in the battle. In 2D she stands 64 px+ at D and 48 px+ on a phone (a small field
// grows her); mid-round she speaks a line with her portrait in a corner of the field, never over the lane, the seed
// rack or Go, and at most one every 8 s; under reduced motion the line only fades in.
type Box = { x: number; y: number; w: number; h: number }
type HG = {
  game(): { phase: string } | null
  sendWave(g: unknown): void
  heroPx(): { h: number; w: number } | null
  heroMood(): string | null
  bark(): { text: string; box: Box; lanes: Box[] } | null
  testBark(kind: string): boolean
}
const hit = (a: Box, b: Box) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5

for (const level of [27, 34]) {
  test(`level ${level}: she is big enough and her round line keeps off the lane, rack and Go`, async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate((lv) => {
      const stars = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), 3]))
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [lv]: true }, seen: {}, tips: Object.fromEntries('ambush boss-move bridge build down early hero knock neighbours neighbours-intro pie pie-ready pop post-uncovered rally rally-intro send showdown spec upgrade x5'.split(' ').map((k) => [k, true])) }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await page.addStyleTag({ content: '#intro { display: none !important; }' })
    const px = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.heroPx())
    expect(px!.h).toBeGreaterThanOrEqual(hasTouch ? 48 : 64)
    await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.sendWave((window as unknown as { hedgerow: HG }).hedgerow.game()))
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.phase)).toBe('wave')
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.intro:not([hidden]) .intro-go')?.click()
      document.getElementById('intro')!.hidden = true
      document.getElementById('bubble')!.hidden = true
    })
    expect(await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.testBark('leak'))).toBe(true)
    const el = page.locator('#cath-bark')
    await expect(el).toBeVisible()
    await expect(el).toContainText(/\w/)
    await page.waitForTimeout(400)
    const b = (await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.bark()))!
    const r = (await el.boundingBox())!
    // Her portrait is in it.
    expect(await el.locator('.cath-bark-face svg').count()).toBe(1)
    const face = (await el.locator('.cath-bark-face').boundingBox())!
    expect(face.width).toBeGreaterThanOrEqual(40)
    for (const l of b.lanes) expect(hit(b.box, l), JSON.stringify({ bark: b.box, lane: l })).toBe(false)
    for (const sel of ['.tray-wrap', '#btn-send', '.controls']) {
      for (const o of await page.locator(sel).all()) {
        const ob = await o.boundingBox()
        if (ob && ob.width) expect(hit({ x: r.x, y: r.y, w: r.width, h: r.height }, { x: ob.x, y: ob.y, w: ob.width, h: ob.height }), sel).toBe(false)
      }
    }
    // A second moment inside 8 s stays quiet (the line already up keeps its words); it goes after its 2.6 s.
    const text = await el.locator('p').textContent()
    await page.evaluate(() => (window as unknown as { hedgerow: { game(): { events: unknown[] } } }).hedgerow.game().events.push({ type: 'rally' }))
    await page.waitForTimeout(300)
    expect(await el.locator('p').textContent()).toBe(text)
    // Her Rally is a cast: arms up.
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.heroMood()), { timeout: 2_000, intervals: [50] }).toBe('cheer')
    await expect(el).toBeHidden({ timeout: 5_000 })
  })
}

test('under reduced motion her round line only fades in', async ({ page }) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 27: true }, seen: {}, tips: Object.fromEntries('ambush boss-move bridge build down early hero knock neighbours neighbours-intro pie pie-ready pop post-uncovered rally rally-intro send showdown spec upgrade x5'.split(' ').map((k) => [k, true])) }))
  })
  await page.goto('/hedgerow/?sandbox=1&2d&level=27')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  await page.addStyleTag({ content: '#intro { display: none !important; }' })
  await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.sendWave((window as unknown as { hedgerow: HG }).hedgerow.game()))
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.phase)).toBe('wave')
  await page.evaluate(() => {
    document.getElementById('intro')!.hidden = true
    document.getElementById('bubble')!.hidden = true
  })
  expect(await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.testBark('boss'))).toBe(true)
  const anim = await page.locator('#cath-bark').evaluate((e) => getComputedStyle(e).animationName)
  expect(anim).toBe('bark-fade')
})
