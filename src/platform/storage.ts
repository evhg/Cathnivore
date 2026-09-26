// SPEC 11.3: autosave storage behind one interface, web (localStorage) vs iPhone (Capacitor
// Preferences) differences hidden behind it. Only the web implementation exists so far (M3); the
// Capacitor Preferences implementation is swapped in behind this same shape once the iPhone shell needs
// it (M5+, see PROGRESS.md).
export interface SavedGame {
  version: 1
  config: import('../engine/types').GameConfig
  seed: number
  actions: import('../engine/types').Action[]
}

export interface KeyValueStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

const webStorage: KeyValueStorage = {
  get: (key) => {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // SPEC 11.3: a failed save should never crash the app; the next autosave attempt may succeed.
    }
  },
  remove: (key) => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

export const storage: KeyValueStorage = webStorage

export const SAVE_KEY = 'cathnivore:save:v1'

export function saveGame(save: SavedGame): void {
  storage.set(SAVE_KEY, JSON.stringify(save))
}

// SPEC 11.3: "If a save fails to load or is from an older version, show 'This save is from an older
// version' with Start New and Try Anyway. Never show a blank screen." `save` carries whatever was
// recovered (present even when `incompatible` is true, so "Try Anyway" has something to attempt replaying)
// and is `null` only when there was truly nothing usable (no save, or unparseable JSON).
export interface LoadGameResult {
  save: SavedGame | null
  incompatible: boolean
}

export function loadGame(): LoadGameResult {
  const raw = storage.get(SAVE_KEY)
  if (!raw) return { save: null, incompatible: false }
  try {
    const parsed = JSON.parse(raw) as SavedGame
    if (parsed.version !== 1) return { save: parsed, incompatible: true }
    return { save: parsed, incompatible: false }
  } catch {
    return { save: null, incompatible: true }
  }
}

export function clearGame(): void {
  storage.remove(SAVE_KEY)
}

// SPEC 8.1: "Campaign progress and carry-over flags are saved separately from game saves."
export interface CampaignProgress {
  version: 1
  completed: string[] // chapter ids finished (won or skipped), in no particular order
  // SPEC 8.2 ch3 carry-over: "Wholesome Hollow Contract" copies still owned (by anyone) at the end of
  // "Growing Season" (0-2, already capped — see `survivingWholesomeHollowContracts`), read by chapter 4's
  // setup to add that many Outlets to Oakvale. Absent (older saves, or chapter 3 never finished) means 0.
  growingSeasonContractsSurviving?: number
}

export const CAMPAIGN_KEY = 'cathnivore:campaign:v1'

export function loadCampaign(): CampaignProgress {
  const raw = storage.get(CAMPAIGN_KEY)
  if (!raw) return { version: 1, completed: [] }
  try {
    const parsed = JSON.parse(raw) as CampaignProgress
    if (parsed.version !== 1) return { version: 1, completed: [] }
    return parsed
  } catch {
    return { version: 1, completed: [] }
  }
}

export function markChapterComplete(chapterId: string): void {
  const progress = loadCampaign()
  if (progress.completed.includes(chapterId)) return
  storage.set(CAMPAIGN_KEY, JSON.stringify({ ...progress, completed: [...progress.completed, chapterId] }))
}

// SPEC 8.2 ch3 carry-over: records how many Wholesome Hollow Contracts survived "Growing Season," for
// chapter 4's setup to read back later. Kept separate from `markChapterComplete` (called alongside it,
// only for chapter 3) since no other chapter has a carry-over value to save yet.
export function recordGrowingSeasonCarryOver(contractsSurviving: number): void {
  const progress = loadCampaign()
  storage.set(CAMPAIGN_KEY, JSON.stringify({ ...progress, growingSeasonContractsSurviving: contractsSurviving }))
}
