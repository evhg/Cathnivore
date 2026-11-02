import type { RegionId } from '../engine/types'

// Plan item 35: the campaign as a map of Marrow you travel. Each chapter is a place on the map (its pin
// sits on the first of its home regions), and winning it frees its home regions: they turn from
// Hollowell orange to green, with bunting. Between them, every region of the Republic is freed once.
export const CHAPTER_HOMES: Record<string, RegionId[]> = {
  'fresh-meat': ['brindleHills', 'highmoor'],
  'word-of-mouth': ['saltmarsh'],
  'growing-season': ['oakvale'],
  'the-plan': ['rivermead'],
  'friends-in-low-places': ['shingleBay'],
  kingsmarket: ['kingsmarket'],
}

// The map's seven regions, as axial hex coordinates (the board's own ring around Kingsmarket).
export const MAP_AXIAL: Record<string, [number, number]> = {
  highmoor: [0, -1],
  saltmarsh: [1, -1],
  brindleHills: [-1, 0],
  kingsmarket: [0, 0],
  rivermead: [1, 0],
  oakvale: [-1, 1],
  shingleBay: [0, 1],
}

/** The regions freed by the chapters won so far. */
export function liberatedRegions(completed: readonly string[]): Set<RegionId> {
  const out = new Set<RegionId>()
  for (const id of completed) for (const r of CHAPTER_HOMES[id] ?? []) out.add(r)
  return out
}

/** Where Cath stands: the first chapter not yet won, in campaign order (the last one once all are won). */
export function currentChapterIndex(chapterIds: readonly string[], completed: readonly string[]): number {
  const i = chapterIds.findIndex((id) => !completed.includes(id))
  return i === -1 ? chapterIds.length - 1 : i
}
