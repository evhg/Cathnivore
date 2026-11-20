import { test, expect } from '@playwright/test'

// Plan item 108: each /games/ poster carries Cath in that game's dress, pose and mood: four distinct poses,
// each covering 15% or less of its card's art, and NIGHT SHIFT's in noir (greyscale, a red rim). Plan item 203:
// NIGHT SHIFT's key art now shows Cath herself, so its sticker is drawn but not displayed (cover 0).
test("each game's poster has its own Cath, small beside the game's art", async ({ page }) => {
  await page.goto('/games/')
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'))
  await page.waitForTimeout(1000)
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.hero-game')].map((card) => {
      const cath = card.querySelector<HTMLElement>('.hero-game-cath')!
      const art = card.querySelector<HTMLElement>('.hero-game-art')!.getBoundingClientRect()
      const c = cath.getBoundingClientRect()
      const w = Math.max(0, Math.min(c.right, art.right) - Math.max(c.left, art.left))
      const h = Math.max(0, Math.min(c.bottom, art.bottom) - Math.max(c.top, art.top))
      return { pose: cath.dataset.pose, drawn: !!cath.querySelector('svg'), cover: (w * h) / (art.width * art.height), filter: getComputedStyle(cath).filter }
    }),
  )
  expect(cards).toHaveLength(4)
  expect(new Set(cards.map((c) => c.pose)).size).toBe(4)
  for (const c of cards) {
    expect(c.drawn).toBe(true)
    expect(c.cover, c.pose).toBeLessThanOrEqual(0.15)
  }
  expect(cards[3]!.filter).toContain('grayscale(1)')
})

// Plan item 563: the card Caths read apart: an average hash (16x16 greyscale of each sticker, its own framing and
// stance, laid on one size) differs by more than 10 bits between every pair of the three painted cards.
test('the card Caths differ pairwise by perceptual hash', async ({ page }) => {
  await page.goto('/games/')
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'))
  const hashes = await page.evaluate(async () => {
    const out: string[] = []
    for (const el of [...document.querySelectorAll<HTMLElement>('.hero-game-cath')].slice(0, 3)) {
      const svg = el.querySelector('svg')!
      const flip = getComputedStyle(svg).scale.startsWith('-1')
      const img = new Image()
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
      await img.decode()
      // the sticker as it sits on the card: its box's aspect, centred on a 16x16 field
      const r = el.getBoundingClientRect()
      const c = document.createElement('canvas')
      c.width = c.height = 16
      const x = c.getContext('2d')!
      x.fillStyle = '#fff'
      x.fillRect(0, 0, 16, 16)
      const k = 16 / Math.max(r.width, r.height)
      const w = r.width * k
      const h = r.height * k
      x.save()
      if (flip) {
        x.translate(16, 0)
        x.scale(-1, 1)
      }
      x.drawImage(img, (16 - w) / 2, 16 - h, w, h)
      x.restore()
      const d = x.getImageData(0, 0, 16, 16).data
      const g: number[] = []
      for (let i = 0; i < d.length; i += 4) g.push(d[i]! * 0.3 + d[i + 1]! * 0.59 + d[i + 2]! * 0.11)
      const mean = g.reduce((a, b) => a + b, 0) / g.length
      out.push(g.map((v) => (v > mean ? '1' : '0')).join(''))
    }
    return out
  })
  expect(hashes).toHaveLength(3)
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) {
      let bits = 0
      for (let b = 0; b < hashes[i]!.length; b++) if (hashes[i]![b] !== hashes[j]![b]) bits++
      expect(bits, `cards ${i} and ${j}`).toBeGreaterThan(10)
    }
})
