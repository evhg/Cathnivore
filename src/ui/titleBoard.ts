// Plan item 60: the title opens on the real table. The board under the title is the game's own Map.tsx, read-only,
// showing the player's campaign: a fresh save shows Hollowell's Outlets dug into every region; each chapter won
// frees its home regions (bunting and the green wash, the producers' stalls standing); a finished campaign frees
// Marrow. Pure: the same save always lays the same table.

import { createGame } from '../engine/state'
import type { GameState, ProducerId, RegionId } from '../engine/types'
import { liberatedRegions } from '../content/campaignMap'

const RING: RegionId[] = ['kingsmarket', 'highmoor', 'saltmarsh', 'rivermead', 'shingleBay', 'oakvale', 'brindleHills']
/** Hollowell's hold on each region on a fresh save: the capital worst, the coast taking a Buyout. */
const HELD: Record<string, { outlets: number; buyouts: number; doubt: number }> = {
  kingsmarket: { outlets: 3, buyouts: 1, doubt: 1 },
  highmoor: { outlets: 2, buyouts: 0, doubt: 0 },
  saltmarsh: { outlets: 1, buyouts: 1, doubt: 1 },
  rivermead: { outlets: 2, buyouts: 0, doubt: 1 },
  shingleBay: { outlets: 2, buyouts: 0, doubt: 0 },
  oakvale: { outlets: 1, buyouts: 0, doubt: 1 },
  brindleHills: { outlets: 2, buyouts: 0, doubt: 0 },
}
/** Who keeps a stall where, once a region is free (Mara and Tomas, the first two producers). */
const STALLS: Record<string, Partial<Record<ProducerId, number>>> = {
  kingsmarket: { mara: 1, tomas: 1 },
  highmoor: { mara: 2 },
  saltmarsh: { tomas: 1 },
  rivermead: { mara: 1, tomas: 1 },
  shingleBay: { tomas: 2 },
  oakvale: { mara: 1 },
  brindleHills: { mara: 1, tomas: 1 },
}

export function titleBoardState(completed: readonly string[]): GameState {
  const base = createGame({ producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: RING }, 2079)
  const free = liberatedRegions(completed)
  const all = completed.includes('kingsmarket')
  const regions = { ...base.regions }
  for (const id of RING) {
    const freed = all || free.has(id)
    const hold = HELD[id]!
    regions[id] = {
      ...regions[id],
      liberated: freed,
      everLiberated: freed,
      outlets: freed ? 0 : hold.outlets,
      buyouts: freed ? 0 : hold.buyouts,
      doubt: freed ? 0 : hold.doubt,
      lostLand: 0,
      // Held regions keep one lonely stall; freed ones fill with the producers.
      stalls: freed ? { ...STALLS[id] } : { [Object.keys(STALLS[id]!)[0]!]: 1 },
    }
  }
  return { ...base, regions, log: [], pendingDecisions: [] }
}
