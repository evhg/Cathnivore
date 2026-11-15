import { describe, expect, it } from 'vitest'
import { mugshotSvg } from '../games/cathode/src/ui/busts'

// Plan item 270: the List's withheld prints are distinct backlit silhouettes, each with its district's prop, and the
// red stamp across the eyes only. Plan item 412: five of them (one a district), each lit in its district's own colour,
// the stamp a strip of torn redaction tape.
describe('withheld mugshots', () => {
  const svgs = [0, 1, 2, 3, 4].map((v) => mugshotSvg(null, `NO. ${v + 1}`, true, v))
  it('draws five different silhouettes', () => {
    const heads = svgs.map((s) => s.match(/<g fill="#08090c">([\s\S]*?)<\/g>/)![1])
    expect(new Set(heads).size).toBe(5)
    expect(new Set(svgs.map((s) => /data-silhouette="(\d)"/.exec(s)![1])).size).toBe(5)
  })
  it('backlights each: a light glow at the head behind a near-black figure, and a rim in that light', () => {
    for (const s of svgs) {
      const glow = /<radialGradient id="r\w+"[^>]*><stop offset="0" stop-color="(#\w+)"/.exec(s)![1]!
      // the glow is light: its brightest channel over half way
      expect(Math.max(...[1, 3, 5].map((k) => parseInt(glow.slice(k, k + 2), 16)))).toBeGreaterThan(128)
      expect(s).toMatch(/stroke="#[0-9a-f]{6}" stroke-width="2" fill="none"/)
    }
  })
  it('keeps the stamp to the face', () => {
    for (const s of svgs) expect(s).toMatch(/<path d="M60 87 [^"]* L138 104.4 [^"]*Z" fill="#b3122a"/)
  })
})

// Plan item 321: the withheld prints' silhouettes (body and head, the near-black figure) are pairwise distinct:
// filled on a grid, any two overlap at 0.7 or less (intersection over union, as item 278).
type Pt = [number, number]
function flatten(d: string): Pt[][] {
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/gi)!
  const polys: Pt[][] = []
  let cur: Pt[] = []
  let i = 0
  let cmd = ''
  const num = () => Number(tok[i++])
  while (i < tok.length) {
    if (/[MLCZ]/i.test(tok[i]!)) cmd = tok[i++]!.toUpperCase()
    if (cmd === 'M') {
      if (cur.length) polys.push(cur)
      cur = [[num(), num()]]
      cmd = 'L'
    } else if (cmd === 'L') cur.push([num(), num()])
    else if (cmd === 'C') {
      const p0 = cur[cur.length - 1]!
      const a: Pt = [num(), num()]
      const b: Pt = [num(), num()]
      const c: Pt = [num(), num()]
      for (let t = 0.1; t <= 1.0001; t += 0.1) {
        const u = 1 - t
        cur.push([u * u * u * p0[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * c[0], u * u * u * p0[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * c[1]])
      }
    } else if (cmd === 'Z') {
      if (cur.length) polys.push(cur)
      cur = []
    }
  }
  if (cur.length) polys.push(cur)
  return polys
}
function fill(paths: string[]): Uint8Array {
  const g = new Uint8Array(200 * 240)
  for (const d of paths)
    for (const poly of flatten(d))
      for (let y = 0; y < 240; y++) {
        const yc = y + 0.5
        const xs: number[] = []
        for (let k = 0; k < poly.length; k++) {
          const [x1, y1] = poly[k]!
          const [x2, y2] = poly[(k + 1) % poly.length]!
          if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1))
        }
        xs.sort((a, b) => a - b)
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k]! - 0.5)); x < Math.min(200, xs[k + 1]! - 0.5); x++) g[y * 200 + x] = 1
      }
  return g
}
describe('withheld silhouettes', () => {
  it('overlap pairwise at 0.7 or less', () => {
    const sils = [0, 1, 2, 3, 4].map((v) => {
      const fig = mugshotSvg(null, 'X', true, v).match(/<g fill="#08090c">([\s\S]*?)<\/g>/)![1]!
      return fill([...fig.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]!))
    })
    for (let a = 0; a < sils.length; a++)
      for (let b = a + 1; b < sils.length; b++) {
        let i = 0
        let u = 0
        for (let k = 0; k < sils[a]!.length; k++) {
          i += sils[a]![k]! & sils[b]![k]!
          u += sils[a]![k]! | sils[b]![k]!
        }
        expect(i / u, `${a} vs ${b}`).toBeLessThanOrEqual(0.7)
      }
  })
})
