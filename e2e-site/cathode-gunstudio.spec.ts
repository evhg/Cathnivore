import { expect, test } from './own-gpu'

// Plan item 588: the class pick's guns are lit as gunmetal, not grey blockouts: the studio's spot pools on the gun and
// falls off, its black stage gives the metal one bright strip to mirror. Each thumbnail's luminance spread (standard
// deviation over its opaque pixels, the Ghost's rim) against the flat studio's before the change (2026-11-21).
const BEFORE: Record<string, number> = { pistol: 25.2, shotgun: 22.7, sniper: 24.3, revolver: 31.0, smg: 22.2, rifle: 22.4, launcher: 25.3 }

test('the gun thumbnails read as lit metal, their light spread well past the flat studio', async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?shot')
  type Front = { cathodeFront?: { scene?: () => { gunIcon(w: string, c?: string): string | null } | null } }
  await page.waitForFunction(() => !!(window as unknown as Front).cathodeFront?.scene?.(), null, { timeout: 200_000 })
  const spread = await page.evaluate(async (models) => {
    const s = (window as unknown as Front).cathodeFront!.scene!()!
    const out: Record<string, number> = {}
    for (const m of models) {
      const img = new Image()
      img.src = s.gunIcon(m, 'ghost')!
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      let n = 0
      let sum = 0
      let sq = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! < 128) continue
        const l = 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!
        n++
        sum += l
        sq += l * l
      }
      out[m] = Math.sqrt(sq / n - (sum / n) ** 2)
    }
    return out
  }, Object.keys(BEFORE))
  const ratios = Object.entries(BEFORE).map(([m, b]) => spread[m]! / b)
  // Every gun at 1.25x or more, the rack as a whole at 1.35x. Item 612 took the rack's exposure from 1.8 to 0.7
  // (gunmetal, not white silhouettes), which narrows the spread: 1.32-1.52x, mean 1.39x (2026-11-21); 1.8 read 1.4x+.
  for (const [m, b] of Object.entries(BEFORE)) expect(spread[m]!, m).toBeGreaterThanOrEqual(b * 1.25)
  expect(ratios.reduce((a, r) => a + r, 0) / ratios.length).toBeGreaterThanOrEqual(1.35)
})
