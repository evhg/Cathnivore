// Plan item 60: the title opens on the real table. The board under the title is the game's own Map.tsx, read-only,
// showing the player's campaign: a fresh save shows Hollowell's Outlets dug into every region; each chapter won
// frees its home regions (bunting and the green wash, the producers' stalls standing); a finished campaign frees
// Marrow. Pure: the same save always lays the same table.

import { createGame } from '../engine/state'
import type { GameState, ProducerId, RegionId } from '../engine/types'
import { CHAPTER_HOMES, liberatedRegions } from '../content/campaignMap'
import { REGIONS } from '../content/map'

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

/** Plan item 60: Cath's line beside the table, by how far the campaign has come. */
export function titleLine(completed: readonly string[]): string {
  const free = completed.includes('kingsmarket') ? 7 : liberatedRegions(completed).size
  if (free >= 7) return 'Marrow is ours again. Same time tomorrow? The market never sleeps.'
  if (free === 0) return "Hollowell's in every stall in Marrow. We start with Brindle Hills."
  if (free <= 2) return `${free} regions back in local hands. Bea drew me a picture to celebrate.`
  return `${free} of 7 regions free. Kingsmarket is starting to worry.`
}

/** Plan item 503: the title's attract beat, a preview of what Campaign will do next. */
export interface ChapterBeat {
  chapter: string
  /** The hex the beat flips: the next unwon chapter's first home region still held. */
  region: RegionId
  /** Cath's one line while it plays. */
  line: string
}

const BEAT_TAIL: Record<string, string> = { kingsmarket: 'Shall we finish it?' }

/** The next unwon chapter's beat, in campaign order; none once Marrow is free. Pure. */
export function nextChapterBeat(completed: readonly string[]): ChapterBeat | null {
  if (completed.includes('kingsmarket')) return null
  const free = liberatedRegions(completed)
  for (const [chapter, homes] of Object.entries(CHAPTER_HOMES)) {
    if (completed.includes(chapter)) continue
    const region = homes.find((r) => !free.has(r))
    if (!region) continue
    return { chapter, region, line: `${REGIONS[region].name} next. ${BEAT_TAIL[chapter] ?? 'Shall we?'}` }
  }
  return null
}
