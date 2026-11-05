import { expect, test } from '@playwright/test'

// Plan item 163: every tower in the build rack is a painted portrait (three of them were grey line sketches with
// their tops cut off by the icon's edge), and the desktop rack's names read at 13 px.
test('every rack portrait is painted and whole, names 13 px at D', async ({ page }) => {
  await page.goto('/hedgerow/?2d&sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 30_000 })
  await page.waitForTimeout(600)
  const cards = await page.evaluate(async () => {
    const out: { name: string; fills: number; topRow: number; font: number }[] = []
    for (const b of document.querySelectorAll<HTMLElement>('.tray .tray-tower')) {
      const im = b.querySelector('img')!
      await im.decode()
      const c = document.createElement('canvas')
      c.width = im.naturalWidth
      c.height = im.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(im, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      // Distinct coloured (not grey) fills, 4 bits a channel, among solid pixels, each 2% or more of the picture.
      const bins = new Map<number, number>()
      let solid = 0
      let topRow = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! < 200) continue
        solid++
        if (i < c.width * 4) topRow++
        const k = ((d[i]! >> 4) << 8) | ((d[i + 1]! >> 4) << 4) | (d[i + 2]! >> 4)
        bins.set(k, (bins.get(k) ?? 0) + 1)
      }
      const fills = [...bins].filter(([k, n]) => {
        const r = (k >> 8) * 17, g = ((k >> 4) & 15) * 17, bl = (k & 15) * 17
        return n >= solid * 0.02 && Math.max(r, g, bl) - Math.min(r, g, bl) >= 48
      }).length
      const name = b.querySelector<HTMLElement>('.tray-name')
      out.push({ name: name?.textContent ?? '', fills, topRow, font: name ? parseFloat(getComputedStyle(name).fontSize) : 0 })
    }
    return out
  })
  expect(cards.length).toBeGreaterThanOrEqual(9)
  const desktop = (page.viewportSize()?.width ?? 0) >= 900
  for (const c of cards) {
    expect(c.fills, `${c.name}: coloured fills`).toBeGreaterThanOrEqual(2)
    // Nothing solid on the icon's top row: the picture isn't cut at its top edge.
    expect(c.topRow, `${c.name}: cut at the top`).toBe(0)
    if (desktop) expect(c.font, `${c.name}: name size`).toBeGreaterThanOrEqual(13)
  }
})
