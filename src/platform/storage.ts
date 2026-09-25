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

export function loadGame(): SavedGame | null {
  const raw = storage.get(SAVE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SavedGame
    if (parsed.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function clearGame(): void {
  storage.remove(SAVE_KEY)
}

// SPEC 8.1: "Campaign progress and carry-over flags are saved separately from game saves."
export interface CampaignProgress {
  version: 1
  completed: string[] // chapter ids finished (won or skipped), in no particular order
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
  storage.set(CAMPAIGN_KEY, JSON.stringify({ version: 1, completed: [...progress.completed, chapterId] }))
}
