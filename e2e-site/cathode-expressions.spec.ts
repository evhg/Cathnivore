import { writeFileSync } from 'node:fs'
import { expect, test } from './own-gpu'

// Plan item 727: her three painted faces (the smirk, a determined set of the jaw, the wink) each read on the title:
// on a held desktop frame, swapping one for another changes more than 2% of her head's pixels, while drawing the
// same face twice changes almost none (the control: the held frame is deterministic, so the change is the face).

type B = { left: number; top: number; right: number; bottom: number }
type S = { menuMood(id: string): void; setTime(t: number): void; faceBox(): B; readonly expression: string }
type W = { cathodeFront?: { ready: boolean; scene(): S } }

test('her three expressions each change her head on the title', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one viewport is enough: the faces are painted on one texture')
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'high' })))
  await page.goto('/nightshift/?front=title&shot&t=1&quality=high')
  await page.waitForFunction(() => (window as unknown as W).cathodeFront?.ready === true, null, { timeout: 150_000 })
  // ?shot draws its held frame a moment after ready (the face canvas uploads on the first draw).
  await page.waitForTimeout(3000)
  const box = await page.evaluate(() => (window as unknown as W).cathodeFront!.scene().faceBox())
  expect(box.bottom - box.top).toBeGreaterThanOrEqual(85)
  // A margin round the face box: the head, not just chin to crown.
  const pad = Math.round((box.bottom - box.top) * 0.15)
  const clip = { x: Math.max(0, box.left - pad), y: Math.max(0, box.top - pad), width: box.right - box.left + 2 * pad, height: box.bottom - box.top + 2 * pad }
  const shoot = async (entry: string, face: string): Promise<string> => {
    await page.evaluate((id) => {
      const s = (window as unknown as W).cathodeFront!.scene()
      s.menuMood(id)
      s.setTime(1)
    }, entry)
    expect(await page.evaluate(() => (window as unknown as W).cathodeFront!.scene().expression)).toBe(face)
    await page.waitForTimeout(1500)
    return (await page.screenshot({ clip })).toString('base64')
  }
  const shots = {
    smirk: await shoot('settings', 'smirk'),
    determined: await shoot('new', 'determined'),
    wink: await shoot('cases', 'wink'),
    again: await shoot('settings', 'smirk'),
  }
  // EXPR_SHOTS=<dir> keeps the crops for looking at.
  const dir = process.env.EXPR_SHOTS
  if (dir) for (const [k, v] of Object.entries(shots)) writeFileSync(`${dir}/expr-${k}.png`, Buffer.from(v, 'base64'))
  // The share of the head's pixels whose largest channel moves by more than 12 of 255.
  const diff = (a: string, b: string) => page.evaluate(async ({ a, b }) => {
    const read = async (s: string) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + s
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      return g.getImageData(0, 0, c.width, c.height).data
    }
    const [p, q] = [await read(a), await read(b)]
    let n = 0
    for (let i = 0; i < p.length; i += 4) {
      if (Math.max(Math.abs(p[i]! - q[i]!), Math.abs(p[i + 1]! - q[i + 1]!), Math.abs(p[i + 2]! - q[i + 2]!)) > 12) n++
    }
    return n / (p.length / 4)
  }, { a, b })
  const m = {
    smirkDetermined: await diff(shots.smirk, shots.determined),
    smirkWink: await diff(shots.smirk, shots.wink),
    determinedWink: await diff(shots.determined, shots.wink),
    control: await diff(shots.smirk, shots.again),
  }
  const msg = JSON.stringify(m)
  expect(m.control, msg).toBeLessThan(0.005)
  expect(m.smirkDetermined, msg).toBeGreaterThan(0.02)
  expect(m.smirkWink, msg).toBeGreaterThan(0.02)
  expect(m.determinedWink, msg).toBeGreaterThan(0.02)
})
