// Bea's garden: every solved daily plants a crop that keeps growing as the days pass.

import type { DailyResult } from './store'
import type { Season } from './season'

export interface Plot {
  day: string
  glyph: string
  stage: 'sprout' | 'growing' | 'ripe'
  /** Solved in par taps or fewer: the crop wears a golden star. */
  gold: boolean
  label: string
}

const CROPS = ['🥕', '🌻', '🍅', '🥬', '🌽', '🍓', '🎃', '🥔']
const VISITORS: Record<Season, [string, string]> = {
  spring: ['🐑', 'A lamb has wandered in to nibble the clover.'],
  summer: ['🦋', 'A butterfly is resting on the sunflowers.'],
  autumn: ['🦔', 'A hedgehog is snuffling through the leaves.'],
  winter: ['🐦', 'A robin is watching the frosty cabbages.'],
}

export const GARDEN_SIZE = 35

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** The newest `GARDEN_SIZE` solved days as plots, oldest first. */
export function gardenPlots(results: Record<string, DailyResult>, today: string): Plot[] {
  const days = Object.keys(results).sort().slice(-GARDEN_SIZE)
  return days.map((day) => {
    const r = results[day]!
    const age = daysBetween(day, today)
    const stage = age < 2 ? 'sprout' : age < 7 ? 'growing' : 'ripe'
    const glyph = stage === 'sprout' ? '🌱' : stage === 'growing' ? '🌿' : CROPS[hash(day) % CROPS.length]!
    const gold = r.taps <= r.par
    const state = stage === 'ripe' ? 'ripe' : stage === 'growing' ? 'still growing' : 'just planted'
    return { day, glyph, stage, gold, label: `${day}: ${state}, solved in ${r.taps} taps (par ${r.par})${gold ? ', a gold star' : ''}.` }
  })
}

export function gardenVisitor(season: Season, plots: Plot[]): { glyph: string; line: string } | null {
  if (plots.length < 3) return null
  const [glyph, line] = VISITORS[season]
  return { glyph, line }
}
