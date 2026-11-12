import { expect, test } from '@playwright/test'

// Plan item 335: NIGHT SHIFT speaks in one noir type system. Every visible word on the title and the class pick is set
// in one of VISION's three faces (the UI face, Cath's voice face, the mono), and none is under 13 px, at P and D.
const FACES = ['Cathode UI', 'Cathode Voice', 'Cathode Mono', 'JetBrains Mono']

for (const [name, url] of [['title', '/nightshift/'], ['class pick', '/nightshift/?play']] as const) {
  test(`the ${name} uses only the three faces, nothing under 13 px`, async ({ page }) => {
    test.setTimeout(150_000)
    await page.addInitScript(() =>
      localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })),
    )
    await page.goto(url)
    if (url.includes('play')) await page.waitForFunction(() => document.querySelector('canvas')?.dataset.class, null, { timeout: 90_000 })
    else await page.locator('#menu').waitFor({ state: 'visible', timeout: 90_000 })
    await page.waitForTimeout(1500)
    const r = await page.evaluate(() => {
      const faces = new Set<string>()
      const small: string[] = []
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        const e = t.parentElement
        if (!t.textContent?.trim() || !e) continue
        const box = e.getBoundingClientRect()
        if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight) continue
        const cs = getComputedStyle(e)
        if (cs.visibility === 'hidden' || Number(cs.opacity) === 0 || cs.display === 'none') continue
        if (e.closest('[hidden], [aria-hidden="true"][data-sr-skip]')) continue
        faces.add(cs.fontFamily.split(',')[0]!.replace(/["']/g, '').trim())
        if (parseFloat(cs.fontSize) < 13 - 0.01) small.push(`${t.textContent.trim().slice(0, 20)} ${cs.fontSize}`)
      }
      return { faces: [...faces], small }
    })
    for (const f of r.faces) expect(FACES, `face ${f}`).toContain(f)
    expect(r.small).toEqual([])
  })
}

// Plan item 335: at D each of The List's rumours reads in 3 lines or fewer, its last line more than one word.
test("The List's rumours run 3 lines or fewer, no one-word last line", async ({ page }) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() =>
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })),
  )
  await page.goto('/nightshift/')
  await page.locator('#menu').waitFor({ state: 'visible', timeout: 90_000 })
  await page.waitForTimeout(1500)
  const rs = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.rumour')]
      .filter((e) => e.offsetParent)
      .map((e) => {
        const lh = parseFloat(getComputedStyle(e).lineHeight)
        const range = document.createRange()
        range.selectNodeContents(e)
        const rects = [...range.getClientRects()]
        const lastTop = Math.max(...rects.map((r) => r.top))
        const lastWords = rects.filter((r) => Math.abs(r.top - lastTop) < 2).reduce((a, r) => a + r.width, 0)
        return { text: e.textContent ?? '', lines: Math.round(e.getBoundingClientRect().height / lh), lastWidth: lastWords }
      }),
  )
  expect(rs.length).toBeGreaterThan(0)
  for (const r of rs) {
    expect(r.lines, r.text).toBeLessThanOrEqual(3)
    // a one-word last line would be a single short span; two words or more run over 40 px at this size
    expect(r.lastWidth, r.text).toBeGreaterThan(40)
  }
})

// Plan item 335: the in-game HUD holds to the same faces and the 13 px floor (D and a landscape phone).
for (const size of [{ width: 1440, height: 900 }, { width: 844, height: 390 }]) {
  test(`the HUD uses only the three faces, nothing under 13 px (${size.width}x${size.height})`, async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'sets its own viewport; one run is enough')
    test.setTimeout(300_000)
    await page.setViewportSize(size)
    await page.goto('/nightshift/')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?play&class=gunslinger&rs=0.5')
    await page.waitForFunction(() => {
      const c = (window as unknown as { cathode?: { job?: unknown; stats: { frames: number } } }).cathode
      return !!c?.job && c.stats.frames >= 3
    }, null, { timeout: 200_000 })
    await page.waitForTimeout(1500)
    const r = await page.evaluate(() => {
      const faces = new Set<string>()
      const small: string[] = []
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        const e = t.parentElement
        if (!t.textContent?.trim() || !e) continue
        const box = e.getBoundingClientRect()
        if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight) continue
        const cs = getComputedStyle(e)
        if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
        faces.add(cs.fontFamily.split(',')[0]!.replace(/["']/g, '').trim())
        if (parseFloat(cs.fontSize) < 13 - 0.01) small.push(`${t.textContent.trim().slice(0, 20)} ${cs.fontSize}`)
      }
      return { faces: [...faces], small }
    })
    for (const f of r.faces) expect(FACES, `face ${f}`).toContain(f)
    expect(r.small).toEqual([])
  })
}
