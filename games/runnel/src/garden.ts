// Bea's garden: every solved daily plants a crop that keeps growing as the days pass.

import type { DailyResult } from './store'
import type { Season } from './season'
import { CROP_IDS, type CropId, type VisitorId } from './gardenart'

export interface Plot {
  day: string
  /** What grows here once ripe (drawn by gardenart.ts at every stage). */
  crop: CropId
  stage: 'sprout' | 'growing' | 'ripe'
  /** Solved in par taps or fewer: the crop wears a golden star. */
  gold: boolean
  label: string
}

const VISITORS: Record<Season, [VisitorId, string]> = {
  spring: ['lamb', 'A lamb has wandered in to nibble the clover.'],
  summer: ['butterfly', 'A butterfly is resting on the sunflowers.'],
  autumn: ['hedgehog', 'A hedgehog is snuffling through the leaves.'],
  winter: ['robin', 'A robin is watching the frosty cabbages.'],
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
    const crop = CROP_IDS[hash(day) % CROP_IDS.length]!
    const gold = r.taps <= r.par
    const state = stage === 'ripe' ? `a ripe ${crop}` : stage === 'growing' ? `a ${crop}, still growing` : 'just planted'
    return { day, crop, stage, gold, label: `${day}: ${state}, solved in ${r.taps} taps (par ${r.par})${gold ? ', a gold star' : ''}.` }
  })
}

export function gardenVisitor(season: Season, plots: Plot[]): { visitor: VisitorId; line: string } | null {
  if (plots.length < 3) return null
  const [visitor, line] = VISITORS[season]
  return { visitor, line }
}
