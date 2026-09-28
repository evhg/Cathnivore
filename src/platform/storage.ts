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
  // SPEC 8.1/11.3: which campaign chapter this save belongs to, absent for a Quick Game/hot-seat save.
  // Needed so a reload mid-chapter can resume back into the `chapterGame` screen (tutorial prompts,
  // scripted mid-game scenes, and — critically — `endChapter`'s `markChapterComplete` call on finishing)
  // rather than silently downgrading into a plain Quick Game that can never mark the chapter complete or
  // carry its story scenes forward. `config`/`seed`/`actions` alone can't tell campaign and Quick Game
  // saves apart (a chapter's `GameConfig` has no chapter id of its own), so this is carried alongside them.
  chapterId?: string
  // SPEC 8.1: which of this chapter's mid-game scripted scenes (e.g. chapter 3's round-5 Wholesome Hollow
  // reveal) have already been dismissed. Dismissal is a UI-only event (no engine action, so nothing in
  // `actions`/the replayed log records it) — without persisting it here separately, a player who dismisses
  // the scene and reloads before their next real action would see it replay once more on resume (a real,
  // if narrow, bug: see DECISIONS.md). Absent/omitted for saves from before this field existed or with no
  // mid-game scenes dismissed yet.
  dismissedMidScenes?: string[]
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
// The in-memory `nativeCache` above is always updated synchronously first, so `get()` is correct for the
// rest of this session regardless of the disk write below. But two rapid `set`/`remove` calls (e.g. a
// human action's autosave immediately followed by the AI teammate's own) previously fired their
// `Preferences` writes independently with no ordering between them — correct today only because iOS's
// Preferences (UserDefaults-backed) happens to process calls FIFO, not because anything in this code
// guarantees it. Chaining every write through one promise makes the actual persisted-to-disk order match
// call order for real, so a future plugin/OS change can't silently let a stale write land last.
let writeQueue: Promise<void> = Promise.resolve()

const nativeStorage: KeyValueStorage = {
  get: (key) => nativeCache.get(key) ?? null,
  set: (key, value) => {
    nativeCache.set(key, value)
    writeQueue = writeQueue.then(() =>
      import('@capacitor/preferences')
        .then(({ Preferences }) => Preferences.set({ key, value }))
        .catch(() => {}),
    )
  },
  remove: (key) => {
    nativeCache.delete(key)
    writeQueue = writeQueue.then(() =>
      import('@capacitor/preferences')
        .then(({ Preferences }) => Preferences.remove({ key }))
        .catch(() => {}),
    )
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
  // SPEC 8.1: "Losing a chapter: offer Retry (same shuffle), Retry (new shuffle) and Play on Easy. After
  // 2 losses, also offer Skip Chapter." Counts consecutive losses since the chapter was last won or
  // skipped, keyed by chapter id. Absent/missing entry means 0 losses recorded yet.
  chapterLossCounts?: Record<string, number>
}

export function loadCampaign(): CampaignProgress {
  const raw = storage.get(CAMPAIGN_KEY)
  if (!raw) return { version: 1, completed: [] }
  try {
    const parsed = JSON.parse(raw) as CampaignProgress
    // Unlike `loadGame`, there's no "Try Anyway" UI for campaign progress (SPEC 11.3's warning screen is
    // only wired up for game saves) — any shape that isn't safe to use as-is just resets to a fresh, empty
    // CampaignProgress, the same way a version mismatch already does below. `completed` is checked
    // explicitly (not just `version`) because every reader — `markChapterComplete` here and the campaign
    // chapter list in App.tsx — calls `.includes`/spreads it as an array with no defensive fallback of its
    // own (unlike `chapterLossCounts`, which every reader guards with `?? {}`); a same-version save with a
    // missing or corrupted `completed` field would otherwise crash on `progress.completed.includes(...)`
    // the moment the campaign screen renders or a chapter finishes, instead of just losing progress.
    if (parsed.version !== 1 || !Array.isArray(parsed.completed)) return { version: 1, completed: [] }
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

// SPEC 8.1: "Losing a chapter: offer Retry (same shuffle), Retry (new shuffle) and Play on Easy. After 2
// losses, also offer Skip Chapter." Called once per chapter loss; returns the new total so the caller
// can decide whether to show Skip Chapter without a second read.
export function recordChapterLoss(chapterId: string): number {
  const progress = loadCampaign()
  const counts = { ...(progress.chapterLossCounts ?? {}) }
  const next = (counts[chapterId] ?? 0) + 1
  counts[chapterId] = next
  storage.set(CAMPAIGN_KEY, JSON.stringify({ ...progress, chapterLossCounts: counts }))
  return next
}

// Resets a chapter's loss streak once it's won (or skipped) — a fresh future attempt (e.g. after a
// campaign reset, or replaying an earlier chapter) starts counting from 0 again rather than carrying over
// stale losses from a previous run.
export function clearChapterLossCount(chapterId: string): void {
  const progress = loadCampaign()
  if (!progress.chapterLossCounts || !(chapterId in progress.chapterLossCounts)) return
  const counts = { ...progress.chapterLossCounts }
  delete counts[chapterId]
  storage.set(CAMPAIGN_KEY, JSON.stringify({ ...progress, chapterLossCounts: counts }))
}
