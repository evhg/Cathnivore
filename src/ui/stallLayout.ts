// Plan item 62: a producer's farm as a market stall that fills up. Each bought Improvement hangs on one of the
// stall's three shelves by its first tag (the fields' produce, the sea's catch, the town's trade), left to right in
// the order bought; past PER_SHELF a shelf stacks crates two deep. Pure, so the desktop column and the phone sheet
// lay the same stall, and the same state always lays it the same way.

export type Shelf = 'fields' | 'sea' | 'town'
export const SHELVES: readonly Shelf[] = ['fields', 'sea', 'town']
const SHELF_OF: Record<string, Shelf> = { pasture: 'fields', crop: 'fields', coast: 'sea', community: 'town', media: 'town', science: 'town' }

/** Crates side by side on one shelf before they start stacking. */
export const PER_SHELF = 4
/** Slot size in stall units (the stall is 4 slots wide, 3 shelves tall). */
export const SLOT_W = 25
export const SLOT_H = 22

export interface StallSlot {
  id: string
  shelf: Shelf
  /** 0-based position along the shelf, and how far up the stack (0 on the shelf, 1 on top). */
  col: number
  layer: number
  x: number
  y: number
}

export function shelfFor(tags: readonly string[] | undefined): Shelf {
  return SHELF_OF[tags?.[0] ?? ''] ?? 'town'
}

export function stallLayout(items: ReadonlyArray<{ id: string; tags: readonly string[] }>): StallSlot[] {
  const count: Record<Shelf, number> = { fields: 0, sea: 0, town: 0 }
  return items.map(({ id, tags }) => {
    const shelf = shelfFor(tags)
    const n = count[shelf]++
    const layer = Math.floor(n / PER_SHELF)
    const col = n % PER_SHELF
    const row = SHELVES.indexOf(shelf)
    // A stacked crate sits half a slot to the right, so the one under it shows.
    return { id, shelf, col, layer, x: col * SLOT_W + layer * (SLOT_W / 2), y: row * SLOT_H - layer * 7 }
  })
}

/** Chalk tallies for the stall's board: how many of each tag the farm holds. */
export function tagTallies(items: ReadonlyArray<{ tags: readonly string[] }>): Array<[string, number]> {
  const t: Record<string, number> = {}
  for (const it of items) for (const tag of it.tags) t[tag] = (t[tag] ?? 0) + 1
  return Object.entries(t).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
