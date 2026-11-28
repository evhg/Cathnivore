import { describe, expect, it } from 'vitest'
import { FACADES, WINDOWS } from '../src/ui/titleSquareLayout'

// Plan item 746: the title's street is not one window repeated: no window style is more than 30% of the street's
// windows, and neighbouring houses never share one.
describe('title square windows', () => {
  it('no style is more than 30% of the windows, neighbours differ', () => {
    let worst = 0
    let total = 0
    const all = new Map<string, number>()
    for (const w of WINDOWS) {
      all.set(w.style, (all.get(w.style) ?? 0) + 1)
      total++
    }
    for (const n of all.values()) worst = Math.max(worst, n / total)
    expect(worst).toBeLessThanOrEqual(0.3)
    const styles = FACADES.map((_, i) => WINDOWS.find((w) => w.x >= FACADES[i]!.x && w.x < FACADES[i]!.x + FACADES[i]!.w)?.style)
    for (let i = 1; i < styles.length; i++) if (styles[i] && styles[i - 1]) expect(styles[i]).not.toBe(styles[i - 1])
  })
})
