import { describe, expect, it } from 'vitest'
import { plural } from '../src/content/plural'
import * as improvements from '../src/content/improvements'
import * as schemes from '../src/content/schemes'
import * as agenda from '../src/content/agenda'
import * as pressure from '../src/content/pressure'
import * as terms from '../src/content/terms'
import * as producers from '../src/content/producers'
import * as chapters from '../src/content/chapters'
import * as tutorial from '../src/content/tutorial'
import * as difficulty from '../src/content/difficulty'

// Plan item 33: card text said "1 Marks". Every string the content modules export is walked, so a new card with
// a counted noun in the wrong form fails here.
const SINGULAR_AS_PLURAL = /(?<![\d.])1 (Marks|Stalls|Outlets|Doubts|Buyouts|rounds|regions|hexes|cards|tokens|Improvements|Schemes)\b/

function strings(v: unknown, seen = new Set<unknown>()): string[] {
  if (typeof v === 'string') return [v]
  if (!v || typeof v !== 'object' || seen.has(v)) return []
  seen.add(v)
  const vals = v instanceof Map ? [...v.values()] : Object.values(v)
  return vals.flatMap((x) => strings(x, seen))
}

describe('plural', () => {
  it('says 1 Mark and 2 Marks', () => {
    expect(plural(1, 'Mark')).toBe('1 Mark')
    expect(plural(0, 'Mark')).toBe('0 Marks')
    expect(plural(2, 'Mark')).toBe('2 Marks')
    expect(plural(1, 'hex', 'hexes')).toBe('1 hex')
    expect(plural(3, 'hex', 'hexes')).toBe('3 hexes')
  })

  it('no card, term, chapter or tutorial text pairs 1 with a plural noun', () => {
    const all = [improvements, schemes, agenda, pressure, terms, producers, chapters, tutorial, difficulty].flatMap((m) => strings(m))
    expect(all.length).toBeGreaterThan(200)
    const bad = all.filter((s) => SINGULAR_AS_PLURAL.test(s))
    expect(bad).toEqual([])
  })
})
