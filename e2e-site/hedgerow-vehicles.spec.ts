import { expect, test } from '@playwright/test'

// Plan item 105: every vehicle on the 2D lane at level 21 (and every fleet rung) is drawn 28 px long or more at D
// and 20 on a phone, at the field's real cell size, and no two vehicle types share a silhouette (overlap under 90%).
type Sil = { w: number; h: number; len: number; mask: number[] }
type HG = { game(): { level: { waves: Array<Array<{ enemy: string }>> } } | null; cellCenter(c: number, r: number): { x: number } | null; enemySilhouette(k: string, cell: number): Sil }

test('2D vehicles are long enough to read and each has its own silhouette', async ({ page, hasTouch }) => {
  test.setTimeout(120_000)
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  const r = await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    const cell = Math.round(hg.cellCenter(1, 0)!.x - hg.cellCenter(0, 0)!.x)
    const kinds = [...new Set(hg.game()!.level.waves.flat().map((g) => g.enemy).concat(['courier', 'hatchback', 'van', 'pickup', 'sprinter', 'lorry', 'quad']))]
    const sils = kinds.map((k) => [k, hg.enemySilhouette(k, cell)] as const)
    const lens = sils.map(([k, s]) => [k, s.len] as const)
    const same: string[] = []
    for (let i = 0; i < sils.length; i++)
      for (let j = i + 1; j < sils.length; j++) {
        const a = sils[i]![1].mask
        const b = sils[j]![1].mask
        let and = 0
        let or = 0
        for (let p = 0; p < a.length; p++) {
          and += a[p]! & b[p]!
          or += a[p]! | b[p]!
        }
        if (or && and / or > 0.9) same.push(`${sils[i]![0]}~${sils[j]![0]}`)
      }
    return { cell, lens, same }
  })
  const min = hasTouch ? 20 : 28
  for (const [k, len] of r.lens) expect(len, `${k} at a ${r.cell} px cell`).toBeGreaterThanOrEqual(min)
  expect(r.same).toEqual([])
})
