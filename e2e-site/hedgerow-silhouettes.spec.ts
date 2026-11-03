import { expect, test } from '@playwright/test'

// Plan item 52: towers you can tell apart at a glance. Every tower's tier-1 body, drawn at a 24 px cell, overlaps
// every other's by less than 70% (intersection over union of their masks).
const URL = '/hedgerow/?2d&sandbox=1'
const KINDS = ['hedgerow', 'scarecrow', 'beehive', 'stall', 'pond', 'barn', 'silo', 'mast', 'tent', 'court', 'hall', 'windmill', 'cannon']
type Sil = { w: number; h: number; mask: number[] }
type HG = { silhouette(kind: string, cell: number): Sil }

test('plan item 52: tier-1 tower silhouettes overlap less than 70% pairwise at 24 px', async ({ page }) => {
  await page.goto(URL)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.silhouette, null, { timeout: 30000 })
  const sils = await page.evaluate((kinds) => kinds.map((k) => (window as unknown as { hedgerow: HG }).hedgerow.silhouette(k, 24)), KINDS)
  const worst: string[] = []
  for (let a = 0; a < KINDS.length; a++)
    for (let b = a + 1; b < KINDS.length; b++) {
      let and = 0
      let or = 0
      sils[a]!.mask.forEach((v, i) => {
        const u = sils[b]!.mask[i]!
        if (v && u) and++
        if (v || u) or++
      })
      const iou = and / Math.max(1, or)
      if (iou >= 0.7) worst.push(`${KINDS[a]}/${KINDS[b]} ${iou.toFixed(2)}`)
      console.log(`${KINDS[a]}/${KINDS[b]} ${iou.toFixed(2)}`)
    }
  expect(worst).toEqual([])
})
