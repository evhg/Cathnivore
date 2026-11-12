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
