// Cath's shared wardrobe (ROADMAP N19): one outfit choice worn in every game and on the landing hero.
// Outfits unlock from progress in each game's own save, read defensively from localStorage so no game has to
// import another. Pure rules (`unlockedOutfits`) plus tiny storage helpers.

import type { CathOutfit } from './cath'

export interface WardrobeProgress {
  /** Hedgerow levels with at least one star. */
  hedgerowLevels: number
  /** Runnel daily puzzles solved. */
  runnelDays: number
  /** NIGHT SHIFT jobs finished. */
  nightJobs: number
}

export interface WardrobeEntry {
  id: CathOutfit
  name: string
  how: string
  unlocked: (p: WardrobeProgress) => boolean
}

export const WARDROBE: WardrobeEntry[] = [
  { id: 'field', name: 'Olive blazer', how: 'Hers from the start.', unlocked: () => true },
  { id: 'wax', name: 'Wax jacket', how: 'Clear 10 Hedgerow levels.', unlocked: (p) => p.hedgerowLevels >= 10 },
  { id: 'pinny', name: 'Garden pinny', how: 'Solve 5 Runnel dailies.', unlocked: (p) => p.runnelDays >= 5 },
  { id: 'market', name: 'Market-day coat', how: 'Finish a NIGHT SHIFT job.', unlocked: (p) => p.nightJobs >= 1 },
  { id: 'trench', name: 'Camel trench', how: 'Clear 30 Hedgerow levels.', unlocked: (p) => p.hedgerowLevels >= 30 },
  {
    id: 'gown',
    name: 'Evening gown',
    how: 'Clear 20 levels, solve 10 dailies and finish 3 jobs.',
    unlocked: (p) => p.hedgerowLevels >= 20 && p.runnelDays >= 10 && p.nightJobs >= 3,
  },
]

export const OUTFIT_KEY = 'cath:outfit'

export function unlockedOutfits(p: WardrobeProgress): CathOutfit[] {
  return WARDROBE.filter((w) => w.unlocked(p)).map((w) => w.id)
}

function readJson(storage: Pick<Storage, 'getItem'>, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const count = (o: unknown): number => (o && typeof o === 'object' ? Object.keys(o).length : 0)

/** Read every game's save from one origin's storage. Anything missing or malformed counts as zero. */
export function readProgress(storage: Pick<Storage, 'getItem'> = localStorage): WardrobeProgress {
  const hedge = readJson(storage, 'hedgerow:v1') as { stars?: Record<string, number> } | null
  const runnel = readJson(storage, 'runnel:v1') as { results?: unknown } | null
  const night = readJson(storage, 'cathode.save') as { jobsDone?: unknown } | null
  return {
    hedgerowLevels: Object.values(hedge?.stars ?? {}).filter((s) => s > 0).length,
    runnelDays: count(runnel?.results),
    nightJobs: Array.isArray(night?.jobsDone) ? night.jobsDone.length : 0,
  }
}

/** The outfit she wears: the saved choice if it is still unlocked, else the blazer. */
export function chosenOutfit(storage: Pick<Storage, 'getItem'> = localStorage): CathOutfit {
  try {
    const want = storage.getItem(OUTFIT_KEY)
    if (want && unlockedOutfits(readProgress(storage)).includes(want as CathOutfit)) return want as CathOutfit
  } catch {
    // Blocked storage: the blazer.
  }
  return 'field'
}

export function chooseOutfit(id: CathOutfit, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(OUTFIT_KEY, id)
  } catch {
    // Not saved this visit.
  }
}
