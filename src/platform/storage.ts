// SPEC 11.3: autosave storage behind one interface, web (localStorage) vs iPhone (Capacitor Preferences)
// differences hidden behind it — "iOS can clear web storage when space is low," which localStorage alone
// inside the bundled app's WKWebView would be exposed to. Every caller in the app (`saveGame`/`loadGame`
// and friends below, `platform/settings.ts`) uses this synchronously — `App.tsx` reads `loadGame()` in its
// very first render, not behind a loading screen — but `@capacitor/preferences`' real API is Promise-based.
// Reconciled with a synchronous in-memory cache: `preloadNativeStorage()` awaits every known key from
// Preferences once, before `main.tsx` renders anything (native only); after that, `nativeStorage.get` reads
// the cache directly (sync) while `set`/`remove` update the cache immediately and fire the real Preferences
// write in the background (matching `haptics.ts`'s "a spurious/late write is a smaller cost than blocking
// the UI" tolerance) — a failed or slow native write behaves the same as `webStorage`'s caught
// `localStorage` exceptions: the in-memory value (and the next autosave) is still correct either way.
import { isNativePlatform } from './native'

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

export const SAVE_KEY = 'cathnivore:save:v1'
export const CAMPAIGN_KEY = 'cathnivore:campaign:v1'

// Every key any part of the app persists, so `preloadNativeStorage()` can warm the whole cache in one
// pass at startup rather than each module needing to register its own key. Written as a literal, not
// imported from `platform/settings.ts` (which owns the real `SETTINGS_KEY` export), since that module
// already imports `storage` from here — importing back would be circular.
const ALL_KEYS = [SAVE_KEY, CAMPAIGN_KEY, 'cathnivore:settings:v1']

const nativeCache = new Map<string, string | null>()

// SPEC 11.3: "a failed save should never crash the app" applies here exactly as it does to `webStorage`'s
// caught `localStorage` exceptions — a native write failing (or merely being slow) leaves the in-memory
// cache as the source of truth for the rest of this session, so the game keeps working; only a genuinely
// persistent failure would cost the *next* app launch's autosave, not this one.
const nativeStorage: KeyValueStorage = {
  get: (key) => nativeCache.get(key) ?? null,
  set: (key, value) => {
    nativeCache.set(key, value)
    void import('@capacitor/preferences')
      .then(({ Preferences }) => Preferences.set({ key, value }))
      .catch(() => {})
  },
  remove: (key) => {
    nativeCache.delete(key)
    void import('@capacitor/preferences')
      .then(({ Preferences }) => Preferences.remove({ key }))
      .catch(() => {})
  },
}

// Called once from `main.tsx`, before anything renders, only inside the bundled iPhone app. A no-op on
// the web build (where `storage` below never uses the cache this fills), so this is always safe to call.
// Never throws/rejects — SPEC 1.3's "never show a blank screen" applies just as much to startup as to a
// mid-game save, so a native read failure just leaves that key's cache entry empty (read back as "no save
// yet") rather than blocking `main.tsx`'s render entirely.
export async function preloadNativeStorage(): Promise<void> {
  if (!isNativePlatform()) return
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Promise.all(
      ALL_KEYS.map(async (key) => {
        const { value } = await Preferences.get({ key })
        nativeCache.set(key, value)
      }),
    )
  } catch {
    // Leave the cache empty; the rest of the app already treats "nothing cached yet" as "no save exists."
  }
}

export const storage: KeyValueStorage = isNativePlatform() ? nativeStorage : webStorage

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
